import { Locale } from '@/common/constants/locales';
import { generateSlug } from '@/common/utils/slug.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { Role, SlugEntityType, TourStatus } from '@prisma/client';
import { AdminTripsQueryDto, CreateTripDto, MyTripsQueryDto, TripBySlugQueryDto, TripQueryDto, TripSort, UpdateTripDto } from './dto/trip.dto';

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly tripSelect = {
    id: true,
    name: true,
    slug: true,
    status: true,
    operatorId: true,
    destinationId: true,
    pricingModel: true,
    wholeUnitType: true,
    basePrice: true,
    priceFrom: true,
    durationMinutesFrom: true,
    pickupModel: true,
    maxPartySize: true,
    minPartySize: true,
    bookingCutoffMinutes: true,
    cancellationHours: true,
    h1Override: true,
    breadcrumbLabel: true,
    aggregateRating: true,
    aggregateReviewCount: true,
    bookingCount: true,
    bookingCountToday: true,
    spotsRemaining: true,
    lastBookedAt: true,
    isSponsored: true,
    isActive: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
    // V2 §4 many-to-many — flattened by flattenTrip() into categoryIds/primaryCategoryId/hubIds.
    categories: { select: { categoryId: true, isPrimary: true } },
    hubs: { select: { hubId: true } },
  } as const;

  /**
   * Flattens the TourCategory/TourHub relation arrays into the response-friendly
   * `categoryIds` / `primaryCategoryId` / `hubIds` shape.
   */
  private flattenTrip<T extends {
    categories?: { categoryId: string; isPrimary: boolean }[];
    hubs?: { hubId: string }[];
  }>(trip: T) {
    const { categories, hubs, ...rest } = trip;
    return {
      ...rest,
      categoryIds: categories?.map((c) => c.categoryId) ?? [],
      primaryCategoryId: categories?.find((c) => c.isPrimary)?.categoryId ?? null,
      hubIds: hubs?.map((h) => h.hubId) ?? [],
    };
  }

  private readonly heroImageSelect = {
    id: true,
    url: true,
    altText: true,
    isHero: true,
    focalX: true,
    focalY: true,
    width: true,
    height: true,
    displayOrder: true,
  } as const;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  async findTripOrThrow(id: string) {
    const trip = await this.prisma.tour.findUnique({
      where: { id },
      select: { ...this.tripSelect },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    return trip;
  }

  private async resolveOperatorId(userId: string, role?: Role): Promise<string> {
    const operator = await this.prisma.operator.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (operator) return operator.id;

    if (role === Role.ADMIN) {
      // Auto-provision an operator record for admin users on first use
      const created = await this.prisma.operator.create({
        data: { userId },
        select: { id: true },
      });
      this.logger.log(`Auto-provisioned operator profile for admin user ${userId}`);
      return created.id;
    }

    throw new BadRequestException('No operator profile found. Please complete your operator registration first.');
  }

  async assertOwnership(
    trip: { operatorId: string },
    userId: string,
    requesterRole: Role,
  ) {
    if (requesterRole === Role.ADMIN) return;
    const operatorId = await this.resolveOperatorId(userId);
    if (trip.operatorId !== operatorId) {
      throw new ForbiddenException('You do not have permission to modify this trip');
    }
  }

  /**
   * Recomputes and persists `priceFrom` (the "From $X" display anchor) for a trip:
   * the cheapest age-band price, or `basePrice` when there are no age bands.
   * Call after any change to basePrice or age bands. Returns the new value.
   *
   * Pass `tx` to run inside the caller's transaction — required when called right
   * after an age-band mutation so the read+update sees a consistent band set
   * (otherwise a concurrent band change can produce a stale `priceFrom`).
   */
  async recomputePriceFrom(
    tourId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal | null> {
    const client = tx ?? this.prisma;
    const trip = await client.tour.findUnique({ where: { id: tourId }, select: { basePrice: true } });
    if (!trip) return null;

    // priceFrom anchors off basePrice. Once the OCTO unit catalog (TourUnit) lands, this
    // recomputes from the cheapest unit price.
    const priceFrom: Prisma.Decimal | null = trip.basePrice ?? null;

    await client.tour.update({ where: { id: tourId }, data: { priceFrom } });
    return priceFrom;
  }

  /**
   * Resolves an ordered list of tour ids to flattened LIVE trips, preserving the input
   * order and dropping any that are missing/not live. Used by manual Collections.
   */
  async findPublicByIds(ids: string[]) {
    if (!ids.length) return [];
    const trips = await this.prisma.tour.findMany({
      where: { id: { in: ids }, status: TourStatus.LIVE, isActive: true },
      select: { ...this.tripSelect, images: { where: { isHero: true }, select: this.heroImageSelect, take: 1 } },
    });
    const byId = new Map(trips.map((t) => [t.id, this.flattenTrip(t)]));
    return ids.map((id) => byId.get(id)).filter((t): t is NonNullable<typeof t> => Boolean(t));
  }

  /**
   * Full-text-ish search across tour name + translations (title/overview/description) +
   * category names + hub names + highlight text. Optionally scoped to a destination.
   * V1 uses case-insensitive `contains` (Postgres ILIKE); upgrade path: a `tsvector` GIN
   * column or Algolia/ElasticSearch for ranking + typo tolerance (V2 §10).
   */
  async search(params: { q?: string; destinationSlug?: string; page?: number; limit?: number }) {
    const { destinationSlug, page = 1, limit = 20 } = params;
    const term = params.q?.trim();
    if (!term || term.length < 2) {
      return { total: 0, page, limit, query: term ?? '', data: [] as ReturnType<typeof this.flattenTrip>[] };
    }
    const ci = { contains: term, mode: 'insensitive' as const };
    const where: Prisma.TourWhereInput = {
      status: TourStatus.LIVE,
      isActive: true,
      ...(destinationSlug && { destination: { slug: destinationSlug } }),
      OR: [
        { name: ci },
        { translations: { some: { OR: [{ title: ci }, { overview: ci }, { description: ci }] } } },
        { categories: { some: { category: { name: ci } } } },
        { hubs: { some: { hub: { name: ci } } } },
        { highlights: { some: { translations: { some: { text: ci } } } } },
      ],
    };
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        select: { ...this.tripSelect, images: { where: { isHero: true }, select: this.heroImageSelect, take: 1 } },
        orderBy: this.buildOrderBy(TripSort.recommended),
        skip,
        take: limit,
      }),
    ]);
    return { total, page, limit, query: term, data: data.map((t) => this.flattenTrip(t)) };
  }

  // ── Public list ───────────────────────────────────────────────────────────────

  // Known/typed query params — everything else in the raw query is treated as an attribute filter.
  private static readonly RESERVED_QUERY_KEYS = new Set([
    'search', 'destinationId', 'categoryId', 'hubId', 'pricingModel',
    'minPrice', 'maxPrice', 'durationMin', 'durationMax', 'ratingMin',
    'locale', 'page', 'limit', 'sort',
  ]);

  async findAll(query: TripQueryDto, rawQuery: Record<string, unknown> = {}) {
    const {
      search, destinationId, categoryId, hubId, pricingModel,
      minPrice, maxPrice, durationMin, durationMax, ratingMin,
      sort = TripSort.recommended, page = 1, limit = 20,
    } = query;

    const where: Prisma.TourWhereInput = { status: TourStatus.LIVE, isActive: true };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (destinationId) where.destinationId = destinationId;
    if (categoryId) where.categories = { some: { categoryId } };
    if (hubId) where.hubs = { some: { hubId } };
    if (pricingModel) where.pricingModel = pricingModel;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {};
      if (minPrice !== undefined) where.basePrice.gte = minPrice;
      if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
    }
    if (durationMin !== undefined || durationMax !== undefined) {
      where.durationMinutesFrom = {};
      if (durationMin !== undefined) where.durationMinutesFrom.gte = durationMin;
      if (durationMax !== undefined) where.durationMinutesFrom.lte = durationMax;
    }
    if (ratingMin !== undefined) where.aggregateRating = { gte: ratingMin };

    // Dynamic attribute filters (V2 §7): any non-reserved query key that maps to a
    // filterable dictionary attribute. Comma = OR within a key; multiple keys = AND.
    const attributeFilters = await this.buildAttributeFilters(rawQuery);
    if (attributeFilters.length > 0) where.AND = attributeFilters;

    const orderBy = this.buildOrderBy(sort);
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        select: {
          ...this.tripSelect,
          images: { where: { isHero: true }, select: this.heroImageSelect, take: 1 },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, sort, data: data.map((t) => this.flattenTrip(t)) };
  }

  /** Maps the requested sort to a Prisma orderBy. */
  private buildOrderBy(sort: TripSort): Prisma.TourOrderByWithRelationInput[] {
    switch (sort) {
      case TripSort.price_asc:
        return [{ basePrice: { sort: 'asc', nulls: 'last' } }];
      case TripSort.price_desc:
        return [{ basePrice: { sort: 'desc', nulls: 'last' } }];
      case TripSort.rating:
        return [{ aggregateRating: { sort: 'desc', nulls: 'last' } }, { aggregateReviewCount: 'desc' }];
      case TripSort.newest:
        return [{ publishedAt: 'desc' }];
      case TripSort.recommended:
      default:
        // V2 weighted "Recommended" (bookings×0.4 + rating×0.3 + recency×0.2 + reviews×0.1).
        // Prisma can't order by a computed expression, so we approximate with a multi-key
        // ordering led by the booking count (the heaviest weight). For an exact score, add a
        // materialized `recommendedScore` column updated by a periodic/worker job and order by it.
        return [
          { isSponsored: 'desc' },
          { bookingCount: 'desc' },
          { aggregateRating: { sort: 'desc', nulls: 'last' } },
          { aggregateReviewCount: 'desc' },
          { publishedAt: 'desc' },
        ];
    }
  }

  /**
   * Turns raw attribute query params into AND-ed `attributes.some` conditions.
   * Only keys present (and filterable) in the dictionary are honored; others are ignored.
   */
  private async buildAttributeFilters(rawQuery: Record<string, unknown>): Promise<Prisma.TourWhereInput[]> {
    const candidates = Object.keys(rawQuery).filter(
      (k) => !TripsService.RESERVED_QUERY_KEYS.has(k) && typeof rawQuery[k] === 'string' && rawQuery[k] !== '',
    );
    if (candidates.length === 0) return [];

    const defs = await this.prisma.attributeDefinition.findMany({
      where: { key: { in: candidates }, isFilterable: true, isActive: true },
      select: { key: true },
    });
    const validKeys = new Set(defs.map((d) => d.key));

    const filters: Prisma.TourWhereInput[] = [];
    for (const key of candidates) {
      if (!validKeys.has(key)) continue;
      const values = String(rawQuery[key]).split(',').map((v) => v.trim()).filter(Boolean);
      if (values.length === 0) continue;
      // Match scalar equality OR JSON-array membership (ENUM_MULTI is stored as a JSON array string).
      const valueOr = values.flatMap((v) => [
        { attributeValue: v },
        { attributeValue: { contains: JSON.stringify(v) } },
      ]);
      filters.push({ attributes: { some: { attributeKey: key, OR: valueOr } } });
    }
    return filters;
  }

  // ── Admin all trips ───────────────────────────────────────────────────────────

  async findAllAdmin(query: AdminTripsQueryDto) {
    const { search, status, operatorId, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TourWhereInput = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;
    if (operatorId) where.operatorId = operatorId;

    const [total, data] = await Promise.all([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        select: {
          ...this.tripSelect,
          images: {
            where: { isHero: true },
            select: this.heroImageSelect,
            take: 1,
          },
          destination: { select: { name: true } },
          categories: { select: { categoryId: true, isPrimary: true, category: { select: { name: true } } } },
          hubs: { select: { hubId: true, hub: { select: { name: true } } } },
          operator: {
            select: {
              id: true,
              companyInfo: { select: { companyName: true } },
              user: { select: { name: true, email: true } },
            },
          },
          _count: {
            select: { images: true, highlights: true, inclusions: true, exclusions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data: data.map((t) => this.flattenCounts(t)) };
  }

  // ── Operator "my trips" ───────────────────────────────────────────────────────

  async findMyTrips(userId: string, userRole: Role, query: MyTripsQueryDto) {
    const operatorId = await this.resolveOperatorId(userId, userRole);
    const { search, status, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TourWhereInput = { operatorId };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;

    const [total, data] = await Promise.all([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        select: {
          ...this.tripSelect,
          images: {
            where: { isHero: true },
            select: this.heroImageSelect,
            take: 1,
          },
          destination: { select: { name: true } },
          categories: { select: { categoryId: true, isPrimary: true, category: { select: { name: true } } } },
          hubs: { select: { hubId: true, hub: { select: { name: true } } } },
          _count: {
            select: { images: true, highlights: true, inclusions: true, exclusions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data: data.map((t) => this.flattenCounts(t)) };
  }

  // ── Single trip ───────────────────────────────────────────────────────────────

  private flattenCounts(trip: any) {
    const { _count, images, operator, destination, categories, hubs, ...rest } = trip;
    const cats = categories ?? [];
    const tourHubs = hubs ?? [];
    const primary = cats.find((c: any) => c.isPrimary);
    return {
      ...rest,
      heroImage: images?.[0] ?? null,
      imageCount: _count?.images ?? 0,
      highlightCount: _count?.highlights ?? 0,
      inclusionCount: _count?.inclusions ?? 0,
      exclusionCount: _count?.exclusions ?? 0,
      destinationName: destination?.name ?? null,
      categoryIds: cats.map((c: any) => c.categoryId),
      primaryCategoryId: primary?.categoryId ?? null,
      primaryCategoryName: primary?.category?.name ?? null,
      categoryNames: cats.map((c: any) => c.category?.name).filter(Boolean),
      hubIds: tourHubs.map((h: any) => h.hubId),
      hubNames: tourHubs.map((h: any) => h.hub?.name).filter(Boolean),
      ...(operator !== undefined && {
        operatorInfo: {
          id: operator.id,
          companyName: operator.companyInfo?.companyName ?? null,
          userName: operator.user.name,
          userEmail: operator.user.email,
        },
      }),
    };
  }

  async findOne(id: string, requesterId: string | null, requesterRole: Role | null) {
    const trip = await this.prisma.tour.findUnique({
      where: { id },
      select: {
        ...this.tripSelect,
        images: {
          where: { isHero: true },
          select: { id: true, url: true, altText: true },
          take: 1,
        },
        destination: { select: { name: true } },
        categories: { select: { categoryId: true, isPrimary: true, category: { select: { name: true } } } },
        hubs: { select: { hubId: true, hub: { select: { name: true } } } },
        _count: {
          select: { images: true, highlights: true, inclusions: true, exclusions: true },
        },
      },
    });

    if (!trip) throw new NotFoundException(`Trip ${id} not found`);

    if (trip.status !== TourStatus.LIVE) {
      if (!requesterId) throw new NotFoundException(`Trip ${id} not found`);
      if (requesterRole !== Role.ADMIN) {
        // trip.operatorId is from the operators table; requesterId is user.id — must resolve
        const operatorId = await this.resolveOperatorId(requesterId);
        if (trip.operatorId !== operatorId) {
          throw new ForbiddenException('You do not have permission to view this trip');
        }
      }
    }

    return this.flattenCounts(trip);
  }

  // ── Public slug-based lookup (trip detail page) ───────────────────────────────

  async findBySlug(slug: string, query: TripBySlugQueryDto) {
    const { destinationSlug, locale = Locale.en } = query;

    // V2 §4/§5: every tour has one flat canonical URL /{destination}/{tour-slug}/.
    // Hubs are a discovery tag, not part of the URL — resolve purely by destination + slug.
    const trip = await this.prisma.tour.findFirst({
      where: {
        slug,
        status: TourStatus.LIVE,
        isActive: true,
        destination: { slug: destinationSlug },
      },
      select: {
        ...this.tripSelect,
        images: {
          select: {
            id: true,
            url: true,
            isHero: true,
            altText: true,
            focalX: true,
            focalY: true,
            width: true,
            height: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        // Fetch both requested locale and EN so we can fallback without a second query
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: { locale: true, title: true, overview: true, description: true, isMachineTranslated: true },
        },
        highlights: {
          select: {
            id: true,
            displayOrder: true,
            translations: {
              where: { locale: { in: [locale, Locale.en] } },
              select: { locale: true, text: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        inclusions: {
          select: {
            id: true,
            icon: true,
            displayOrder: true,
            translations: {
              where: { locale: { in: [locale, Locale.en] } },
              select: { locale: true, label: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        exclusions: {
          select: {
            id: true,
            icon: true,
            displayOrder: true,
            translations: {
              where: { locale: { in: [locale, Locale.en] } },
              select: { locale: true, label: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        addOns: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            unit: true,
            maxQuantity: true,
            displayOrder: true,
          },
          orderBy: { displayOrder: 'asc' },
        },
        languages: {
          select: { id: true, language: true },
          orderBy: { language: 'asc' },
        },
      },
    });

    if (!trip) throw new NotFoundException('Trip not found');

    // Apply locale → EN fallback for translated child models
    const { translations, highlights, inclusions, exclusions, languages, ...rest } = trip;

    const resolvedTranslation =
      translations.find((t) => t.locale === locale) ??
      translations.find((t) => t.locale === Locale.en) ??
      null;

    const resolvedHighlights = highlights.map((h) => ({
      id: h.id,
      displayOrder: h.displayOrder,
      text:
        (h.translations.find((t) => t.locale === locale) ??
          h.translations.find((t) => t.locale === Locale.en))?.text ?? '',
    }));

    const resolvedInclusions = inclusions.map((i) => ({
      id: i.id,
      icon: i.icon,
      displayOrder: i.displayOrder,
      label:
        (i.translations.find((t) => t.locale === locale) ??
          i.translations.find((t) => t.locale === Locale.en))?.label ?? '',
    }));

    const resolvedExclusions = exclusions.map((e) => ({
      id: e.id,
      icon: e.icon,
      displayOrder: e.displayOrder,
      label:
        (e.translations.find((t) => t.locale === locale) ??
          e.translations.find((t) => t.locale === Locale.en))?.label ?? '',
    }));

    return {
      ...this.flattenTrip(rest),
      translation: resolvedTranslation,
      highlights: resolvedHighlights,
      inclusions: resolvedInclusions,
      exclusions: resolvedExclusions,
      languages: languages.map((l) => l.language),
    };
  }

  // ── Slug uniqueness resolution ────────────────────────────────────────────────

  /**
   * Returns a slug that is unique for (destinationId, destinationSlug).
   *
   * - Same operator already owns the slug → ConflictException (duplicate trip).
   * - Different operator or slug_registry occupies it → append the operator's
   *   company/user name as a suffix, then try -2, -3 … until a free slot is found.
   */
  private async resolveUniqueSlug(
    baseSlug: string,
    destinationId: string,
    destinationSlug: string,
    operatorId: string,
  ): Promise<string> {
    // If this operator already has this exact slug → hard conflict, no auto-fix.
    const ownConflict = await this.prisma.tour.findFirst({
      where: { destinationId, slug: baseSlug, operatorId },
      select: { id: true },
    });
    if (ownConflict) {
      throw new ConflictException(`You already have a trip with slug "${baseSlug}" at this destination`);
    }

    // V2 §5: every tour is flat /{destination}/{tour-slug}/, so ALWAYS check the slug registry.
    const [tripConflict, registryConflict] = await Promise.all([
      this.prisma.tour.findFirst({ where: { destinationId, slug: baseSlug }, select: { id: true } }),
      this.prisma.slugRegistry.findUnique({
        where: { destinationSlug_slug: { destinationSlug, slug: baseSlug } },
        select: { id: true },
      }),
    ]);

    if (!tripConflict && !registryConflict) return baseSlug;

    // Slug is occupied by another entity — append the operator name (V2 pages 11–15).
    // NEVER append a number (-2, -3): confusing for users and bad for SEO.
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
      select: {
        companyInfo: { select: { companyName: true } },
        user: { select: { name: true } },
      },
    });
    const rawName =
      operator?.companyInfo?.companyName ??
      operator?.user?.name ??
      operatorId.slice(0, 8);
    const suffix = generateSlug(rawName);
    const candidate = `${baseSlug}-${suffix}`;

    const [candidateTrip, candidateRegistry] = await Promise.all([
      this.prisma.tour.findFirst({ where: { destinationId, slug: candidate }, select: { id: true, operatorId: true } }),
      this.prisma.slugRegistry.findUnique({
        where: { destinationSlug_slug: { destinationSlug, slug: candidate } },
        select: { id: true },
      }),
    ]);

    if (candidateTrip?.operatorId === operatorId) {
      throw new ConflictException(`You already have a trip with slug "${candidate}" at this destination`);
    }
    if (!candidateTrip && !candidateRegistry) return candidate;

    // The operator-name suffix is also taken. We do NOT fall back to numeric suffixes,
    // so the operator must pick a different tour name or slug.
    throw new ConflictException(
      `Both "${baseSlug}" and "${candidate}" are already taken at this destination. ` +
        `Please choose a different tour name or slug.`,
    );
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async create(dto: CreateTripDto, userId: string, userRole: Role) {
    const operatorId = await this.resolveOperatorId(userId, userRole);

    const baseSlug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);

    // Validate destination
    const destination = await this.prisma.destination.findUnique({
      where: { id: dto.destinationId },
      select: { id: true, slug: true, isActive: true },
    });
    if (!destination || !destination.isActive) {
      throw new BadRequestException('Destination not found or is not active');
    }

    // Validate categories (V2 §4: 1+ categories, one primary).
    const categoryIds = [...new Set(dto.categoryIds)];
    if (categoryIds.length === 0) {
      throw new BadRequestException('At least one category is required');
    }
    const primaryCategoryId = dto.primaryCategoryId ?? categoryIds[0];
    if (!categoryIds.includes(primaryCategoryId)) {
      throw new BadRequestException('primaryCategoryId must be one of categoryIds');
    }
    const foundCategories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, isActive: true },
      select: { id: true },
    });
    if (foundCategories.length !== categoryIds.length) {
      throw new BadRequestException('One or more categories not found or not active');
    }

    const hubIds = [...new Set(dto.hubIds ?? [])];

    // Resolve a unique slug — always checks the slug registry (flat URLs, V2 §5).
    const slug = await this.resolveUniqueSlug(baseSlug, dto.destinationId, destination.slug, operatorId);

    return this.prisma.$transaction(async (tx) => {
      // Hub validation inside transaction (TOCTOU-safe). A hub is allowed if it belongs to
      // the destination AND at least one of the tour's categories is in its allowed list.
      for (const hubId of hubIds) {
        const hub = await tx.hub.findUnique({
          where: { id: hubId },
          select: { id: true, destinationId: true, isActive: true },
        });
        if (!hub || !hub.isActive) {
          throw new BadRequestException(`Hub ${hubId} not found or is not active`);
        }
        if (hub.destinationId !== dto.destinationId) {
          throw new BadRequestException(`Hub ${hubId} does not belong to the specified destination`);
        }
        const allowedCount = await tx.hubAllowedCategory.count({
          where: { hubId, categoryId: { in: categoryIds } },
        });
        if (allowedCount === 0) {
          throw new BadRequestException(`None of the tour's categories are allowed in hub ${hubId}`);
        }
      }

      const trip = await tx.tour
        .create({
          data: {
            name: dto.name,
            slug,
            operatorId,
            destinationId: dto.destinationId,
            pricingModel: dto.pricingModel,
            wholeUnitType: dto.wholeUnitType ?? null,
            basePrice: dto.basePrice ?? null,
            priceFrom: dto.basePrice ?? null, // from = base; recomputed when the unit catalog lands
            durationMinutesFrom: dto.durationMinutesFrom ?? null,
            pickupModel: dto.pickupModel,
            maxPartySize: dto.maxPartySize ?? null,
            minPartySize: dto.minPartySize ?? 1,
            bookingCutoffMinutes: dto.bookingCutoffMinutes ?? 120,
            cancellationHours: dto.cancellationHours ?? 24,
            h1Override: dto.h1Override ?? null,
            breadcrumbLabel: dto.breadcrumbLabel ?? null,
            categories: {
              create: categoryIds.map((categoryId) => ({
                categoryId,
                isPrimary: categoryId === primaryCategoryId,
              })),
            },
            hubs: { create: hubIds.map((hubId) => ({ hubId })) },
          },
          select: this.tripSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            // Race-condition fallback: slug was taken between our pre-check and the write.
            throw new ConflictException(`Slug "${slug}" was taken concurrently. Please retry.`);
          }
          throw err;
        });

      // V2 §5: every tour gets a flat /{destination}/{tour-slug}/ slug_registry TOUR row.
      await tx.slugRegistry
        .create({
          data: {
            destinationSlug: destination.slug,
            slug: trip.slug,
            entityType: SlugEntityType.TOUR,
            entityId: trip.id,
            isActive: true,
          },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(`Slug "${slug}" is already taken at destination "${destination.slug}"`);
          }
          throw err;
        });

      this.logger.log(`Operator ${operatorId} created trip "${dto.name}" (${trip.id})`);
      return this.flattenTrip(trip);
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateTripDto, requesterId: string, requesterRole: Role) {
    const trip = await this.findTripOrThrow(id);
    await this.assertOwnership(trip, requesterId, requesterRole);

    if (trip.status === TourStatus.ARCHIVED) {
      throw new BadRequestException('Cannot update an archived trip');
    }

    const warnings: string[] = [];

    // Validate category set if a replacement was supplied.
    let categoryIds: string[] | undefined;
    let primaryCategoryId: string | undefined;
    if (dto.categoryIds !== undefined) {
      categoryIds = [...new Set(dto.categoryIds)];
      if (categoryIds.length === 0) throw new BadRequestException('At least one category is required');
      primaryCategoryId = dto.primaryCategoryId ?? categoryIds[0];
      if (!categoryIds.includes(primaryCategoryId)) {
        throw new BadRequestException('primaryCategoryId must be one of categoryIds');
      }
      const found = await this.prisma.category.findMany({
        where: { id: { in: categoryIds }, isActive: true },
        select: { id: true },
      });
      if (found.length !== categoryIds.length) {
        throw new BadRequestException('One or more categories not found or not active');
      }
    }
    const hubIds = dto.hubIds !== undefined ? [...new Set(dto.hubIds)] : undefined;

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.tour.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.pricingModel !== undefined && { pricingModel: dto.pricingModel }),
          ...(dto.wholeUnitType !== undefined && { wholeUnitType: dto.wholeUnitType }),
          ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
          ...(dto.durationMinutesFrom !== undefined && { durationMinutesFrom: dto.durationMinutesFrom }),
          ...(dto.pickupModel !== undefined && { pickupModel: dto.pickupModel }),
          ...(dto.maxPartySize !== undefined && { maxPartySize: dto.maxPartySize }),
          ...(dto.minPartySize !== undefined && { minPartySize: dto.minPartySize }),
          ...(dto.bookingCutoffMinutes !== undefined && { bookingCutoffMinutes: dto.bookingCutoffMinutes }),
          ...(dto.cancellationHours !== undefined && { cancellationHours: dto.cancellationHours }),
          ...(dto.h1Override !== undefined && { h1Override: dto.h1Override }),
          ...(dto.breadcrumbLabel !== undefined && { breadcrumbLabel: dto.breadcrumbLabel }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
      });

      // Replace the full category set, or just re-point the primary among existing.
      if (categoryIds) {
        await tx.tourCategory.deleteMany({ where: { tourId: id } });
        await tx.tourCategory.createMany({
          data: categoryIds.map((categoryId) => ({
            tourId: id,
            categoryId,
            isPrimary: categoryId === primaryCategoryId,
          })),
        });
      } else if (dto.primaryCategoryId !== undefined) {
        const existing = await tx.tourCategory.findUnique({
          where: { tourId_categoryId: { tourId: id, categoryId: dto.primaryCategoryId } },
          select: { id: true },
        });
        if (!existing) throw new BadRequestException('primaryCategoryId must be one of the tour categories');
        await tx.tourCategory.updateMany({ where: { tourId: id }, data: { isPrimary: false } });
        await tx.tourCategory.update({ where: { id: existing.id }, data: { isPrimary: true } });
      }

      // Replace the full hub set (validate destination + allowed-category).
      if (hubIds) {
        const effectiveCategoryIds =
          categoryIds ??
          (await tx.tourCategory.findMany({ where: { tourId: id }, select: { categoryId: true } })).map(
            (c) => c.categoryId,
          );
        for (const hubId of hubIds) {
          const hub = await tx.hub.findUnique({
            where: { id: hubId },
            select: { id: true, destinationId: true, isActive: true },
          });
          if (!hub || !hub.isActive) throw new BadRequestException(`Hub ${hubId} not found or is not active`);
          if (hub.destinationId !== trip.destinationId) {
            throw new BadRequestException(`Hub ${hubId} does not belong to the destination`);
          }
          const allowedCount = await tx.hubAllowedCategory.count({
            where: { hubId, categoryId: { in: effectiveCategoryIds } },
          });
          if (allowedCount === 0) {
            throw new BadRequestException(`None of the tour's categories are allowed in hub ${hubId}`);
          }
        }
        await tx.tourHub.deleteMany({ where: { tourId: id } });
        await tx.tourHub.createMany({ data: hubIds.map((hubId) => ({ tourId: id, hubId })) });
      }

      return tx.tour.findUniqueOrThrow({ where: { id }, select: this.tripSelect });
    });

    // Keep the "From $X" anchor in sync if basePrice changed.
    if (dto.basePrice !== undefined) {
      updated.priceFrom = await this.recomputePriceFrom(id);
    }

    this.logger.log(`User ${requesterId} updated trip ${id}`);
    return { trip: this.flattenTrip(updated), warnings };
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────────

  async publish(id: string, userId: string, userRole: Role) {
    const trip = await this.prisma.tour.findUnique({
      where: { id },
      select: {
        ...this.tripSelect,
        images: { select: { id: true, isHero: true } },
        highlights: { select: { id: true } },
        translations: { where: { locale: Locale.en }, select: { overview: true } },
      },
    });
    if (!trip) throw new NotFoundException(`Trip ${id} not found`);
    await this.assertOwnership(trip, userId, userRole);
    if (trip.status !== TourStatus.DRAFT) {
      throw new BadRequestException('Trip must be in DRAFT status to publish');
    }

    const errors: string[] = [];
    if (trip.images.length < 5) errors.push('At least 5 images are required to publish');
    if (!trip.images.some((img) => img.isHero)) errors.push('A hero image must be set before publishing');

    const enTranslation = trip.translations[0];
    if (!enTranslation?.overview?.trim()) errors.push('An English overview is required to publish');

    if (trip.highlights.length < 3) errors.push('At least 3 highlights are required to publish');

    // Price required: a flat basePrice (the OCTO unit catalog will extend this later).
    if (trip.basePrice == null) {
      errors.push('A price is required to publish (set a base price)');
    }

    if (errors.length > 0) throw new BadRequestException(errors);

    const updated = await this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.LIVE, publishedAt: new Date() },
      select: this.tripSelect,
    });

    this.logger.log(`User ${userId} published trip ${id}`);
    return this.flattenTrip(updated);
  }

  async pause(id: string, userId: string, userRole: Role) {
    const trip = await this.findTripOrThrow(id);
    await this.assertOwnership(trip, userId, userRole);
    if (trip.status !== TourStatus.LIVE) {
      throw new BadRequestException('Trip must be LIVE to pause');
    }

    // Phase 5 hook: if trip holds a featured slot → SlotsService.releaseSlot()

    const updated = await this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.PAUSED },
      select: this.tripSelect,
    });

    this.logger.log(`User ${userId} paused trip ${id}`);
    return this.flattenTrip(updated);
  }

  async unpause(id: string, userId: string, userRole: Role) {
    const trip = await this.findTripOrThrow(id);
    await this.assertOwnership(trip, userId, userRole);
    if (trip.status !== TourStatus.PAUSED) {
      throw new BadRequestException('Trip must be PAUSED to unpause');
    }

    const updated = await this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.LIVE },
      select: this.tripSelect,
    });

    this.logger.log(`User ${userId} unpaused trip ${id}`);
    return this.flattenTrip(updated);
  }

  async archive(id: string, requesterId: string, requesterRole: Role) {
    const trip = await this.findTripOrThrow(id);
    await this.assertOwnership(trip, requesterId, requesterRole);

    if (trip.status === TourStatus.ARCHIVED) {
      throw new BadRequestException('Trip is already archived');
    }

    // Phase 5 hook: if trip holds a featured slot → SlotsService.releaseSlot()

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tour.update({
        where: { id },
        data: { status: TourStatus.ARCHIVED, isActive: false },
        select: this.tripSelect,
      });

      // Every tour has a flat TOUR slug_registry row → deactivate it (keeps the slug reserved).
      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.TOUR, entityId: id },
        data: { isActive: false },
      });

      this.logger.log(`User ${requesterId} archived trip ${id}`);
      return this.flattenTrip(updated);
    });
  }

  async restore(id: string, requesterId: string, requesterRole: Role) {
    const trip = await this.findTripOrThrow(id);
    await this.assertOwnership(trip, requesterId, requesterRole);

    if (trip.status !== TourStatus.ARCHIVED) {
      throw new BadRequestException('Only ARCHIVED trips can be restored');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tour.update({
        where: { id },
        data: { status: TourStatus.DRAFT, isActive: true },
        select: this.tripSelect,
      });

      // Re-activate the flat TOUR slug_registry row.
      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.TOUR, entityId: id },
        data: { isActive: true },
      });

      this.logger.log(`User ${requesterId} restored trip ${id} to DRAFT`);
      return this.flattenTrip(updated);
    });
  }

  async remove(id: string, userId: string, userRole: Role) {
    const trip = await this.findTripOrThrow(id);
    await this.assertOwnership(trip, userId, userRole);
    if (userRole !== Role.ADMIN && trip.status !== TourStatus.ARCHIVED) {
      throw new BadRequestException('Only ARCHIVED trips can be permanently deleted. Archive the trip first.');
    }

    await this.prisma.$transaction(async (tx) => {
      // Every tour has a flat TOUR slug_registry row → remove it.
      await tx.slugRegistry.deleteMany({
        where: { entityType: SlugEntityType.TOUR, entityId: id },
      });
      // Cascade deletes all child models (incl. TourCategory/TourHub) via onDelete: Cascade
      await tx.tour.delete({ where: { id } });
    });

    this.logger.log(`User ${userId} permanently deleted trip ${id}`);
    return { message: 'Trip permanently deleted' };
  }
}
