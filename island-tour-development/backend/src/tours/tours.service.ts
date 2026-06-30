import { Locale } from '@/common/constants/locales';
import {
  clearCooledDownSlugs,
  isSlugTaken,
  markSlugsDeleted,
  renameEntitySlug,
  slugRowBlocks,
} from '@/common/utils/slug-registry.util';
import { generateSlug } from '@/common/utils/slug.util';
import { PrismaService } from '@/prisma/prisma.service';
import { evaluateLikelyToSellOut } from './demand-signal';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import {
  BandParticipation,
  DepartureStatus,
  Role,
  SlugEntityType,
  TourStatus,
} from '@prisma/client';
import {
  AdminToursQueryDto,
  CreateTourDto,
  MyToursQueryDto,
  TourBySlugQueryDto,
  TourQueryDto,
  TourSort,
  UpdateTourDto,
} from './dto/tour.dto';

@Injectable()
export class ToursService {
  private readonly logger = new Logger(ToursService.name);

  constructor(private readonly prisma: PrismaService) {}

  private readonly tourSelect = {
    id: true,
    name: true,
    slug: true,
    status: true,
    operatorId: true,
    destinationId: true,
    timeZone: true,
    availabilityType: true,
    instantDelivery: true,
    availabilityRequired: true,
    allowFreesale: true,
    deliveryFormats: true,
    deliveryMethods: true,
    redemptionMethod: true,
    reference: true,
    pricingModel: true,
    wholeUnitType: true,
    defaultCurrency: true,
    basePrice: true,
    priceFrom: true,
    durationMinutesFrom: true,
    durationMinutesTo: true,
    pickupModel: true,
    pickupRequired: true,
    maxPartySize: true,
    minPartySize: true,
    bookingCutoffMinutes: true,
    cancellationHours: true,
    startTimes: true,
    instantConfirmation: true,
    // Booking / payment (master E.3)
    paymentModel: true,
    depositPct: true,
    bookingType: true,
    // Meeting point / departure (master E.3)
    meetingPointLat: true,
    meetingPointLng: true,
    departureCity: true,
    checkInMinutesBefore: true,
    // Audience / accessibility flags (master E.3)
    minAgeYears: true,
    fitnessLevel: true,
    weatherDependent: true,
    wheelchairAccessible: true,
    familyFriendly: true,
    suitableForBeginners: true,
    isLocalsFavourite: true,
    // Commercial tier (master §7) - read-only
    commissionTier: true,
    tierKey: true,
    tierRank: true,
    tierLockedUntil: true,
    qualityScore: true,
    eligibilityState: true,
    graceStartedAt: true,
    graceMetric: true,
    isBookable: true,
    availabilityConfirmedAt: true,
    firstPublishedAt: true,
    h1Override: true,
    breadcrumbLabel: true,
    ogImage: true,
    aggregateRating: true,
    aggregateReviewCount: true,
    ratingDistribution: true,
    photoReviewCount: true,
    bookingCount: true,
    bookingCountToday: true,
    spotsRemaining: true,
    lastBookedAt: true,
    isSponsored: true,
    likelyToSellOut: true,
    likelyToSellOutOverride: true,
    isActive: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
    // V2 §4 many-to-many - flattened by flattenTour() into categoryIds/primaryCategoryId/hubIds.
    categories: { select: { categoryId: true, isPrimary: true } },
    hubs: { select: { hubId: true } },
  } as const;

  /**
   * Flattens the TourCategory/TourHub relation arrays into the response-friendly
   * `categoryIds` / `primaryCategoryId` / `hubIds` shape.
   */
  private flattenTour<
    T extends {
      categories?: { categoryId: string; isPrimary: boolean }[];
      hubs?: { hubId: string }[];
    },
  >(tour: T) {
    const { categories, hubs, ...rest } = tour;
    return {
      ...rest,
      categoryIds: categories?.map((c) => c.categoryId) ?? [],
      primaryCategoryId:
        categories?.find((c) => c.isPrimary)?.categoryId ?? null,
      hubIds: hubs?.map((h) => h.hubId) ?? [],
    };
  }

  /**
   * Listing badge for a tour card (master §3.6 "Badges" + §3.7 "Demand
   * signaling"). A card shows AT MOST ONE badge in its top-left slot; this
   * resolves overlaps by priority and returns the frontend `TourBadge` key
   * directly (no translation layer needed). Full write-up:
   * `technical-doc/03-implementation/TOUR-BADGES.md`.
   *
   * Priority (first match wins):
   *   1. 'sponsored'        Paid placement = an ACTIVE Destination Spotlight (master
   *                         "paid placements P1-P3"; max 3 per destination). The
   *                         spotlight lifecycle mirrors that onto `tour.isSponsored`
   *                         (TiersService.runSpotlightLifecycle / approveSpotlight),
   *                         which this reads. Master: "always shown on paid placement;
   *                         transparency is a brand pillar" - so it outranks every
   *                         earned badge. (Commission tier alone is NOT sponsored.)
   *   2. 'likelyToSellOut'  Demand signal (§3.7), evaluated daily: tour_age >= 90d
   *                         AND >= 3 sellouts in the last 60d AND < 40% availability
   *                         over the next 30d. Computed by `evaluateLikelyToSellOut`
   *                         (src/tours/demand-signal.ts) into `tour.likelyToSellOut`;
   *                         the manual CMS launch override (`likelyToSellOutOverride`)
   *                         wins when set. Read here as `override ?? computed`. It is
   *                         the most selective badge (~5-10% of catalog), so it ranks
   *                         above 'mostPopular'.
   *   3. 'mostPopular'      Organic social proof: NOT sponsored, review_count >= 10
   *                         AND rating >= 4.5. Master also caps it at "max 1 per
   *                         category"; that listing-level dedup belongs to the
   *                         ranking pass (§7.2) and is intentionally NOT applied
   *                         here - this returns per-tour eligibility only.
   *   4. 'new'              Freshness: published < 30 days ago AND review_count == 0.
   *                         On the card it replaces the rating row.
   *
   * 2 and 4 are mutually exclusive (age >= 90 vs < 30); 3 and 4 are mutually
   * exclusive (>= 10 reviews vs 0). The only real overlaps are 'sponsored' with any
   * earned badge (sponsored wins) and 'likelyToSellOut' with 'mostPopular'.
   */
  private deriveTourBadge(
    tour: {
      isSponsored: boolean;
      likelyToSellOut: boolean;
      likelyToSellOutOverride: boolean | null;
      publishedAt: Date | null;
      aggregateRating: number | null;
      aggregateReviewCount: number;
    },
    now: Date = new Date(),
  ): 'sponsored' | 'likelyToSellOut' | 'mostPopular' | 'new' | null {
    // 1. Sponsored (paid placement) - always shown, outranks earned badges.
    if (tour.isSponsored) return 'sponsored';

    // 2. Likely to sell out (§3.7) - the daily-evaluated demand signal stored on
    //    `likelyToSellOut` (worker output, see src/tours/demand-signal.ts), with the
    //    manual CMS launch override taking precedence (`override ?? computed`).
    if (tour.likelyToSellOutOverride ?? tour.likelyToSellOut)
      return 'likelyToSellOut';

    // 3. Most popular - earned by organic reviews (never on commission-tier grounds).
    if (tour.aggregateReviewCount >= 10 && (tour.aggregateRating ?? 0) >= 4.5) {
      return 'mostPopular';
    }

    // 4. New - recently published with no reviews yet.
    if (tour.aggregateReviewCount === 0 && tour.publishedAt) {
      const ageDays = (now.getTime() - tour.publishedAt.getTime()) / 86_400_000;
      if (ageDays < 30) return 'new';
    }

    return null;
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

  async findTourOrThrow(id: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id },
      select: { ...this.tourSelect },
    });
    if (!tour) throw new NotFoundException(`Tour ${id} not found`);
    return tour;
  }

  private async resolveOperatorId(
    userId: string,
    role?: Role,
  ): Promise<string> {
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
      this.logger.log(
        `Auto-provisioned operator profile for admin user ${userId}`,
      );
      return created.id;
    }

    throw new BadRequestException(
      'No operator profile found. Please complete your operator registration first.',
    );
  }

  async assertOwnership(
    tour: { operatorId: string },
    userId: string,
    requesterRole: Role,
  ) {
    if (requesterRole === Role.ADMIN) return;
    const operatorId = await this.resolveOperatorId(userId);
    if (tour.operatorId !== operatorId) {
      throw new ForbiddenException(
        'You do not have permission to modify this tour',
      );
    }
  }

  /**
   * Recomputes and persists `priceFrom` (the "From $X" display anchor) for a tour:
   * the cheapest age-band price, or `basePrice` when there are no age bands.
   * Call after any change to basePrice or age bands. Returns the new value.
   *
   * Pass `tx` to run inside the caller's transaction - required when called right
   * after an age-band mutation so the read+update sees a consistent band set
   * (otherwise a concurrent band change can produce a stale `priceFrom`).
   */
  async recomputePriceFrom(
    tourId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<Prisma.Decimal | null> {
    const client = tx ?? this.prisma;
    const tour = await client.tour.findUnique({
      where: { id: tourId },
      select: { basePrice: true },
    });
    if (!tour) return null;

    // priceFrom anchors off the cheapest TourAgeBand once bands are entered, and
    // falls back to basePrice when none exist yet.
    const cheapestBand = await client.tourAgeBand.findFirst({
      where: { tourId, participation: BandParticipation.PARTICIPANT },
      orderBy: { price: 'asc' },
      select: { price: true },
    });
    const priceFrom: Prisma.Decimal | null =
      cheapestBand?.price ?? tour.basePrice ?? null;

    await client.tour.update({ where: { id: tourId }, data: { priceFrom } });
    return priceFrom;
  }

  /**
   * Resolves an ordered list of tour ids to flattened LIVE tours, preserving the input
   * order and dropping any that are missing/not live. Used by manual Collections.
   */
  async findPublicByIds(ids: string[]) {
    if (!ids.length) return [];
    const tours = await this.prisma.tour.findMany({
      where: { id: { in: ids }, status: TourStatus.LIVE, isActive: true },
      select: {
        ...this.tourSelect,
        images: {
          where: { isHero: true },
          select: this.heroImageSelect,
          take: 1,
        },
      },
    });
    const byId = new Map(tours.map((t) => [t.id, this.flattenTour(t)]));
    return ids
      .map((id) => byId.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
  }

  /**
   * Full-text-ish search across tour name + translations (title/overview/description) +
   * category names + hub names. Optionally scoped to a destination.
   * V1 uses case-insensitive `contains` (Postgres ILIKE); upgrade path: a `tsvector` GIN
   * column or Algolia/ElasticSearch for ranking + typo tolerance (V2 §10).
   */
  async search(params: {
    q?: string;
    destinationSlug?: string;
    date?: string;
    locale?: Locale;
    page?: number;
    limit?: number;
  }) {
    const {
      destinationSlug,
      locale = Locale.en,
      page = 1,
      limit = 20,
    } = params;
    const term = params.q?.trim();
    if (!term || term.length < 2) {
      return {
        total: 0,
        page,
        limit,
        query: term ?? '',
        data: [] as ReturnType<typeof this.flattenSearchHit>[],
      };
    }
    // Optional date filter: keep only tours with a bookable (OPEN) departure on
    // that calendar date. Departure.date is a `@db.Date`, so we match midnight UTC.
    const parsedDate =
      params.date && !Number.isNaN(Date.parse(`${params.date}T00:00:00.000Z`))
        ? new Date(`${params.date}T00:00:00.000Z`)
        : null;
    const ci = { contains: term, mode: 'insensitive' as const };
    const where: Prisma.TourWhereInput = {
      status: TourStatus.LIVE,
      isActive: true,
      ...(destinationSlug && { destination: { slug: destinationSlug } }),
      ...(parsedDate && {
        departures: {
          some: { date: parsedDate, status: DepartureStatus.OPEN },
        },
      }),
      OR: [
        { name: ci },
        {
          translations: {
            some: {
              OR: [{ title: ci }, { overview: ci }, { description: ci }],
            },
          },
        },
        { categories: { some: { category: { name: ci } } } },
        { hubs: { some: { hub: { name: ci } } } },
      ],
    };
    const skip = (page - 1) * limit;
    const [total, data] = await Promise.all([
      this.prisma.tour.count({ where }),
      this.prisma.tour.findMany({
        where,
        select: {
          ...this.tourSelect,
          // Each hit must carry enough to build its flat URL (/{dest}/{slug}) and
          // show a localized title without a second round-trip.
          destination: { select: { slug: true } },
          translations: { where: { locale }, select: { title: true } },
          images: {
            where: { isHero: true },
            select: this.heroImageSelect,
            take: 1,
          },
        },
        orderBy: this.buildOrderBy(TourSort.recommended),
        skip,
        take: limit,
      }),
    ]);
    return {
      total,
      page,
      limit,
      query: term,
      data: data.map((t) => ({
        ...this.flattenSearchHit(t),
        badge: this.deriveTourBadge(t),
      })),
    };
  }

  /**
   * Flattens a search hit into a link-ready shape: adds `destinationSlug` and a
   * localized `title` (falling back to the canonical `name`), and drops the raw
   * `destination`/`translations` relations.
   */
  private flattenSearchHit<
    T extends {
      name: string;
      destination?: { slug: string } | null;
      translations?: { title: string | null }[];
      categories?: { categoryId: string; isPrimary: boolean }[];
      hubs?: { hubId: string }[];
    },
  >(hit: T) {
    const { destination, translations, ...rest } = hit;
    return {
      ...this.flattenTour(rest),
      destinationSlug: destination?.slug ?? null,
      title: translations?.[0]?.title?.trim() || hit.name,
    };
  }

  // ── Public list ───────────────────────────────────────────────────────────────

  // Known/typed query params - everything else in the raw query is treated as an attribute filter.
  private static readonly RESERVED_QUERY_KEYS = new Set([
    'search',
    'destinationId',
    'categoryId',
    'hubId',
    'isLocalsFavourite',
    'pricingModel',
    'minPrice',
    'maxPrice',
    'durationMin',
    'durationMax',
    'ratingMin',
    'locale',
    'page',
    'limit',
    'sort',
  ]);

  async findAll(query: TourQueryDto, rawQuery: Record<string, unknown> = {}) {
    const {
      search,
      destinationId,
      categoryId,
      hubId,
      isLocalsFavourite,
      pricingModel,
      minPrice,
      maxPrice,
      durationMin,
      durationMax,
      ratingMin,
      sort = TourSort.recommended,
      locale = Locale.en,
      page = 1,
      limit = 20,
    } = query;

    // Bookability filter (master §7.2): a tour is excluded from every ranked result
    // set when it is not live, not active, or not bookable. (The master's "no
    // availability in the next 30 days" exclusion is carried by `isBookable`, which
    // the nightly availability job clears - we avoid a per-request departures join.)
    const where: Prisma.TourWhereInput = {
      status: TourStatus.LIVE,
      isActive: true,
      isBookable: true,
    };
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (destinationId) where.destinationId = destinationId;
    if (categoryId) where.categories = { some: { categoryId } };
    if (hubId) where.hubs = { some: { hubId } };
    if (isLocalsFavourite !== undefined)
      where.isLocalsFavourite = isLocalsFavourite;
    if (pricingModel) where.pricingModel = pricingModel;
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.basePrice = {};
      if (minPrice !== undefined) where.basePrice.gte = minPrice;
      if (maxPrice !== undefined) where.basePrice.lte = maxPrice;
    }
    if (durationMin !== undefined || durationMax !== undefined) {
      where.durationMinutesFrom = {};
      if (durationMin !== undefined)
        where.durationMinutesFrom.gte = durationMin;
      if (durationMax !== undefined)
        where.durationMinutesFrom.lte = durationMax;
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
          ...this.tourSelect,
          // Localized title for the card (falls back to the canonical name).
          translations: { where: { locale }, select: { title: true } },
          // Destination slug so a listing item can build its flat URL even when
          // the list is not scoped to a single destination.
          destination: { select: { slug: true } },
          images: {
            where: { isHero: true },
            select: this.heroImageSelect,
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const mapped = data.map(({ translations, destination, ...t }) => ({
      ...this.flattenTour(t),
      title: translations[0]?.title ?? t.name,
      destinationSlug: destination?.slug ?? null,
      badge: this.deriveTourBadge(t),
    }));

    // §3.8 diversity pass runs after ranking, on the default ("recommended") sort
    // only - explicit price/rating sorts keep the exact order the user requested.
    const ordered =
      sort === TourSort.recommended ? this.applyDiversityPass(mapped) : mapped;

    return { total, page, limit, sort, data: ordered };
  }

  /**
   * Recomputes the §3.7 "Likely to sell out" demand signal and writes it to
   * `tour.likelyToSellOut`. Production runs this daily (BullMQ nightly job, master
   * §workers); it is also exposed as an admin endpoint for on-demand refresh. Pass
   * `tourId` to evaluate a single tour, omit to sweep every LIVE tour. The manual
   * `likelyToSellOutOverride` is NOT touched here - it is applied at read time.
   */
  async recomputeLikelyToSellOut(
    tourId?: string,
  ): Promise<{ evaluated: number; flagged: number }> {
    const tours = await this.prisma.tour.findMany({
      where: tourId ? { id: tourId } : { status: TourStatus.LIVE },
      select: { id: true },
    });
    const now = new Date();
    let flagged = 0;
    for (const t of tours) {
      const computed = await evaluateLikelyToSellOut(this.prisma, t.id, now);
      if (computed) flagged++;
      await this.prisma.tour.update({
        where: { id: t.id },
        data: { likelyToSellOut: computed },
      });
    }
    this.logger.log(
      `recomputeLikelyToSellOut: evaluated ${tours.length} tour(s), flagged ${flagged}`,
    );
    return { evaluated: tours.length, flagged };
  }

  /**
   * Maps the requested sort to a Prisma orderBy. Full write-up:
   * technical-doc/03-implementation/TOUR-RANKING.md.
   *
   * The DEFAULT ("recommended", shown to travelers as "Locals' favorites") is the
   * canonical platform ranking from master §7.2:
   *
   *     tier_rank ASC, quality_score DESC, id ASC
   *
   * - `tier_rank` (1=premium … 5=standard) is denormalized from the operator's
   *   commission tier, so paid placements naturally float to the top - there is NO
   *   separate "isSponsored" sort key (the Sponsored *badge* is cosmetic, §3.6).
   * - `quality_score` (0-100) is a nightly job output, read-only here.
   * - `id` is the stable final tie-break (same-tier collisions are expected and
   *   valid; there is no per-category tier cap).
   *
   * This supersedes the earlier weighted formulas (conflict log B.17 / B.46). The
   * §3.8 diversity pass runs AFTER this ordering, in `applyDiversityPass`.
   */
  private buildOrderBy(sort: TourSort): Prisma.TourOrderByWithRelationInput[] {
    switch (sort) {
      case TourSort.price_asc:
        return [
          { priceFrom: { sort: 'asc', nulls: 'last' } },
          { basePrice: 'asc' },
        ];
      case TourSort.price_desc:
        return [
          { priceFrom: { sort: 'desc', nulls: 'last' } },
          { basePrice: 'desc' },
        ];
      case TourSort.rating:
        return [
          { aggregateRating: { sort: 'desc', nulls: 'last' } },
          { aggregateReviewCount: 'desc' },
        ];
      case TourSort.newest:
        return [{ publishedAt: 'desc' }];
      case TourSort.recommended:
      default:
        // Master §7.2 canonical order.
        return [{ tierRank: 'asc' }, { qualityScore: 'desc' }, { id: 'asc' }];
    }
  }

  /**
   * Diversity pass (master §3.8): after ranking, never allow more than 2 tours of
   * the same subtype (primary category) consecutively. Runs on the already-ordered
   * page in-place, preserving rank as much as possible: when a 3rd same-subtype tour
   * would land back-to-back-to-back, the next tour of a DIFFERENT subtype is pulled
   * up to break the run. Only reorders the default ("recommended") sort - explicit
   * price/rating sorts are left exactly as the user asked. Page-local by design
   * (it operates on the fetched page, not across pagination boundaries).
   */
  private applyDiversityPass<T extends { primaryCategoryId: string | null }>(
    items: T[],
  ): T[] {
    const result: T[] = [];
    const pool = [...items];
    while (pool.length > 0) {
      // The subtype that would form a 3-run if placed next (last two already match).
      const blocked =
        result.length >= 2 &&
        result[result.length - 1].primaryCategoryId ===
          result[result.length - 2].primaryCategoryId
          ? result[result.length - 1].primaryCategoryId
          : undefined;

      // Default: keep strict rank order - take the earliest-ranked tour that won't
      // form a 3-run. We deviate ONLY when the most-abundant remaining subtype is
      // "tight" (count*2 - 1 >= remaining), i.e. it needs an every-other slot to
      // stay interleavable; then we lead with it so it isn't stranded into a 3-run
      // at the tail. This keeps tier_rank order intact except where §3.8 forces a
      // minimal change (so paid tiers are not pushed down for cosmetic spacing).
      const counts = new Map<string | null, number>();
      for (const p of pool) {
        counts.set(
          p.primaryCategoryId,
          (counts.get(p.primaryCategoryId) ?? 0) + 1,
        );
      }
      let tightCat: string | null | undefined;
      let maxCount = 0;
      for (const [cat, c] of counts) {
        if (cat === blocked) continue;
        if (c > maxCount) {
          maxCount = c;
          tightCat = cat;
        }
      }

      const pickCat = maxCount * 2 - 1 >= pool.length ? tightCat : undefined;
      let pick = pool.findIndex((p) =>
        pickCat !== undefined
          ? p.primaryCategoryId === pickCat
          : p.primaryCategoryId !== blocked,
      );
      if (pick === -1) pick = 0; // only blocked items remain (infeasible) -> keep order

      result.push(pool.splice(pick, 1)[0]);
    }
    return result;
  }

  /**
   * Turns raw attribute query params into AND-ed `attributes.some` conditions.
   * Only keys present (and filterable) in the dictionary are honored; others are ignored.
   */
  private async buildAttributeFilters(
    rawQuery: Record<string, unknown>,
  ): Promise<Prisma.TourWhereInput[]> {
    const candidates = Object.keys(rawQuery).filter(
      (k) =>
        !ToursService.RESERVED_QUERY_KEYS.has(k) &&
        typeof rawQuery[k] === 'string' &&
        rawQuery[k] !== '',
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
      const values = String(rawQuery[key])
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (values.length === 0) continue;
      // Match scalar equality OR JSON-array membership (ENUM_MULTI is stored as a JSON array string).
      const valueOr = values.flatMap((v) => [
        { attributeValue: v },
        { attributeValue: { contains: JSON.stringify(v) } },
      ]);
      filters.push({
        attributes: { some: { attributeKey: key, OR: valueOr } },
      });
    }
    return filters;
  }

  // ── Admin all tours ───────────────────────────────────────────────────────────

  async findAllAdmin(query: AdminToursQueryDto) {
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
          ...this.tourSelect,
          images: {
            where: { isHero: true },
            select: this.heroImageSelect,
            take: 1,
          },
          destination: { select: { name: true } },
          categories: {
            select: {
              categoryId: true,
              isPrimary: true,
              category: { select: { name: true } },
            },
          },
          hubs: { select: { hubId: true, hub: { select: { name: true } } } },
          operator: {
            select: {
              id: true,
              companyInfo: { select: { companyName: true } },
              user: { select: { name: true, email: true } },
            },
          },
          _count: {
            select: {
              images: true,
              inclusions: true,
              exclusions: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data: data.map((t) => this.flattenCounts(t)) };
  }

  // ── Operator "my tours" ───────────────────────────────────────────────────────

  async findMyTours(userId: string, userRole: Role, query: MyToursQueryDto) {
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
          ...this.tourSelect,
          images: {
            where: { isHero: true },
            select: this.heroImageSelect,
            take: 1,
          },
          destination: { select: { name: true } },
          categories: {
            select: {
              categoryId: true,
              isPrimary: true,
              category: { select: { name: true } },
            },
          },
          hubs: { select: { hubId: true, hub: { select: { name: true } } } },
          _count: {
            select: {
              images: true,
              inclusions: true,
              exclusions: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data: data.map((t) => this.flattenCounts(t)) };
  }

  // ── Single tour ───────────────────────────────────────────────────────────────

  private flattenCounts(tour: any) {
    const { _count, images, operator, destination, categories, hubs, ...rest } =
      tour;
    const cats = categories ?? [];
    const tourHubs = hubs ?? [];
    const primary = cats.find((c: any) => c.isPrimary);
    return {
      ...rest,
      heroImage: images?.[0] ?? null,
      imageCount: _count?.images ?? 0,
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

  async findOne(
    id: string,
    requesterId: string | null,
    requesterRole: Role | null,
  ) {
    const tour = await this.prisma.tour.findUnique({
      where: { id },
      select: {
        ...this.tourSelect,
        images: {
          where: { isHero: true },
          select: { id: true, url: true, altText: true },
          take: 1,
        },
        destination: { select: { name: true } },
        categories: {
          select: {
            categoryId: true,
            isPrimary: true,
            category: { select: { name: true } },
          },
        },
        hubs: { select: { hubId: true, hub: { select: { name: true } } } },
        _count: {
          select: {
            images: true,
            inclusions: true,
            exclusions: true,
          },
        },
      },
    });

    if (!tour) throw new NotFoundException(`Tour ${id} not found`);

    if (tour.status !== TourStatus.LIVE) {
      if (!requesterId) throw new NotFoundException(`Tour ${id} not found`);
      if (requesterRole !== Role.ADMIN) {
        // tour.operatorId is from the operators table; requesterId is user.id - must resolve
        const operatorId = await this.resolveOperatorId(requesterId);
        if (tour.operatorId !== operatorId) {
          throw new ForbiddenException(
            'You do not have permission to view this tour',
          );
        }
      }
    }

    return this.flattenCounts(tour);
  }

  // ── Public slug-based lookup (tour detail page) ───────────────────────────────

  async findBySlug(slug: string, query: TourBySlugQueryDto) {
    const { destinationSlug, locale = Locale.en } = query;

    // V2 §4/§5: every tour has one flat canonical URL /{destination}/{tour-slug}/.
    // Hubs are a discovery tag, not part of the URL - resolve purely by destination + slug.
    const tour = await this.prisma.tour.findFirst({
      where: {
        slug,
        status: TourStatus.LIVE,
        isActive: true,
        destination: { slug: destinationSlug },
      },
      select: {
        ...this.tourSelect,
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
          select: {
            locale: true,
            title: true,
            overview: true,
            description: true,
            shortDescription: true,
            whatToBring: true,
            knowBeforeYouGo: true,
            notSuitableFor: true,
            whatToExpectIntro: true,
            categoryDisplay: true,
            localTip: true,
            meetingPointText: true,
            metaTitle: true,
            metaDescription: true,
            isMachineTranslated: true,
          },
        },
        ageBands: {
          select: {
            id: true,
            bandType: true,
            participation: true,
            label: true,
            minAge: true,
            maxAge: true,
            price: true,
            priceOriginal: true,
            priceNet: true,
            isDefault: true,
            displayOrder: true,
          },
          orderBy: [
            { participation: 'asc' },
            { isDefault: 'desc' },
            { displayOrder: 'asc' },
          ],
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
            type: true,
            priceText: true,
            displayOrder: true,
            translations: {
              where: { locale: { in: [locale, Locale.en] } },
              select: { locale: true, label: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        locations: {
          select: {
            id: true,
            types: true,
            latitude: true,
            longitude: true,
            streetAddress: true,
            addressLocality: true,
            addressRegion: true,
            postalCode: true,
            addressCountry: true,
            minutesTo: true,
            minutesAt: true,
            displayOrder: true,
            translations: {
              where: { locale: { in: [locale, Locale.en] } },
              select: { locale: true, title: true, shortDescription: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        pickupLocations: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
            address: true,
            minutesPrior: true,
            windowStart: true,
            windowEnd: true,
            displayOrder: true,
            translations: {
              where: { locale: { in: [locale, Locale.en] } },
              select: { locale: true, title: true, directions: true },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
        features: {
          select: {
            id: true,
            type: true,
            displayOrder: true,
            translations: {
              where: { locale: { in: [locale, Locale.en] } },
              select: { locale: true, text: true },
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

    if (!tour) throw new NotFoundException('Tour not found');

    // Apply locale → EN fallback for translated child models
    const {
      translations,
      inclusions,
      exclusions,
      locations,
      pickupLocations,
      features,
      languages,
      ...rest
    } = tour;

    const resolvedTranslation =
      translations.find((t) => t.locale === locale) ??
      translations.find((t) => t.locale === Locale.en) ??
      null;

    const resolvedInclusions = inclusions.map((i) => ({
      id: i.id,
      icon: i.icon,
      displayOrder: i.displayOrder,
      label:
        (
          i.translations.find((t) => t.locale === locale) ??
          i.translations.find((t) => t.locale === Locale.en)
        )?.label ?? '',
    }));

    const resolvedExclusions = exclusions.map((e) => ({
      id: e.id,
      icon: e.icon,
      type: e.type,
      priceText: e.priceText,
      displayOrder: e.displayOrder,
      label:
        (
          e.translations.find((t) => t.locale === locale) ??
          e.translations.find((t) => t.locale === Locale.en)
        )?.label ?? '',
    }));

    const resolvedLocations = locations.map((l) => {
      const tr =
        l.translations.find((t) => t.locale === locale) ??
        l.translations.find((t) => t.locale === Locale.en);
      return {
        id: l.id,
        types: l.types,
        latitude: l.latitude,
        longitude: l.longitude,
        streetAddress: l.streetAddress,
        addressLocality: l.addressLocality,
        addressRegion: l.addressRegion,
        postalCode: l.postalCode,
        addressCountry: l.addressCountry,
        minutesTo: l.minutesTo,
        minutesAt: l.minutesAt,
        displayOrder: l.displayOrder,
        title: tr?.title ?? '',
        shortDescription: tr?.shortDescription ?? null,
      };
    });

    const resolvedPickupLocations = pickupLocations.map((p) => {
      const tr =
        p.translations.find((t) => t.locale === locale) ??
        p.translations.find((t) => t.locale === Locale.en);
      return {
        id: p.id,
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
        minutesPrior: p.minutesPrior,
        windowStart: p.windowStart,
        windowEnd: p.windowEnd,
        displayOrder: p.displayOrder,
        title: tr?.title ?? p.name,
        directions: tr?.directions ?? null,
      };
    });

    const resolvedFeatures = features.map((f) => ({
      id: f.id,
      type: f.type,
      displayOrder: f.displayOrder,
      text:
        (
          f.translations.find((t) => t.locale === locale) ??
          f.translations.find((t) => t.locale === Locale.en)
        )?.text ?? '',
    }));

    return {
      ...this.flattenTour(rest),
      translation: resolvedTranslation,
      ageBands: rest.ageBands,
      inclusions: resolvedInclusions,
      exclusions: resolvedExclusions,
      locations: resolvedLocations,
      pickupLocations: resolvedPickupLocations,
      features: resolvedFeatures,
      languages: languages.map((l) => l.language),
    };
  }

  // ── Slug uniqueness resolution ────────────────────────────────────────────────

  /**
   * Returns a slug that is unique for (destinationId, destinationSlug).
   *
   * - Same operator already owns the slug → ConflictException (duplicate tour).
   * - Different operator or slug_registry occupies it → append the operator's
   *   company/user name as a suffix, then try -2, -3 … until a free slot is found.
   * - A slug whose registry row was hard-deleted more than 90 days ago is free again.
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
      throw new ConflictException(
        `You already have a tour with slug "${baseSlug}" at this destination`,
      );
    }

    // V2 §5: every tour is flat /{destination}/{tour-slug}/, so ALWAYS check the slug registry.
    const [tourConflict, registryRow] = await Promise.all([
      this.prisma.tour.findFirst({
        where: { destinationId, slug: baseSlug },
        select: { id: true },
      }),
      this.prisma.slugRegistry.findUnique({
        where: { destinationSlug_slug: { destinationSlug, slug: baseSlug } },
        select: { id: true, deletedAt: true },
      }),
    ]);
    const registryConflict = slugRowBlocks(registryRow);

    if (!tourConflict && !registryConflict) return baseSlug;

    // Slug is occupied by another entity - append the operator name (V2 pages 11–15).
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

    const [candidateTour, candidateRegistryRow] = await Promise.all([
      this.prisma.tour.findFirst({
        where: { destinationId, slug: candidate },
        select: { id: true, operatorId: true },
      }),
      this.prisma.slugRegistry.findUnique({
        where: { destinationSlug_slug: { destinationSlug, slug: candidate } },
        select: { id: true, deletedAt: true },
      }),
    ]);

    if (candidateTour?.operatorId === operatorId) {
      throw new ConflictException(
        `You already have a tour with slug "${candidate}" at this destination`,
      );
    }
    if (!candidateTour && !slugRowBlocks(candidateRegistryRow))
      return candidate;

    // The operator-name suffix is also taken. We do NOT fall back to numeric suffixes,
    // so the operator must pick a different tour name or slug.
    throw new ConflictException(
      `Both "${baseSlug}" and "${candidate}" are already taken at this destination. ` +
        `Please choose a different tour name or slug.`,
    );
  }

  // ── Create ────────────────────────────────────────────────────────────────────

  async create(dto: CreateTourDto, userId: string, userRole: Role) {
    const operatorId = await this.resolveOperatorId(userId, userRole);

    const baseSlug = dto.slug ? generateSlug(dto.slug) : generateSlug(dto.name);

    // Validate destination
    const destination = await this.prisma.destination.findUnique({
      where: { id: dto.destinationId },
      select: { id: true, slug: true, isActive: true, timezone: true },
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
      throw new BadRequestException(
        'primaryCategoryId must be one of categoryIds',
      );
    }
    const foundCategories = await this.prisma.category.findMany({
      where: { id: { in: categoryIds }, isActive: true },
      select: { id: true },
    });
    if (foundCategories.length !== categoryIds.length) {
      throw new BadRequestException(
        'One or more categories not found or not active',
      );
    }

    const hubIds = [...new Set(dto.hubIds ?? [])];

    // Resolve a unique slug - always checks the slug registry (flat URLs, V2 §5).
    const slug = await this.resolveUniqueSlug(
      baseSlug,
      dto.destinationId,
      destination.slug,
      operatorId,
    );

    return this.prisma.$transaction(async (tx) => {
      // Hub validation inside transaction (TOCTOU-safe). A hub is allowed if it belongs to
      // the destination AND at least one of the tour's categories is in its allowed list.
      for (const hubId of hubIds) {
        const hub = await tx.hub.findUnique({
          where: { id: hubId },
          select: { id: true, destinationId: true, isActive: true },
        });
        if (!hub || !hub.isActive) {
          throw new BadRequestException(
            `Hub ${hubId} not found or is not active`,
          );
        }
        if (hub.destinationId !== dto.destinationId) {
          throw new BadRequestException(
            `Hub ${hubId} does not belong to the specified destination`,
          );
        }
        const allowedCount = await tx.hubAllowedCategory.count({
          where: { hubId, categoryId: { in: categoryIds } },
        });
        if (allowedCount === 0) {
          throw new BadRequestException(
            `None of the tour's categories are allowed in hub ${hubId}`,
          );
        }
      }

      const tour = await tx.tour
        .create({
          data: {
            name: dto.name,
            slug,
            operatorId,
            destinationId: dto.destinationId,
            timeZone: destination.timezone ?? 'America/Curacao',
            pricingModel: dto.pricingModel,
            wholeUnitType: dto.wholeUnitType ?? null,
            ...(dto.defaultCurrency !== undefined && {
              defaultCurrency: dto.defaultCurrency,
            }),
            basePrice: dto.basePrice ?? null,
            priceFrom: dto.basePrice ?? null, // from = base; recomputed when the unit catalog lands
            durationMinutesFrom: dto.durationMinutesFrom ?? null,
            durationMinutesTo: dto.durationMinutesTo ?? null,
            pickupModel: dto.pickupModel,
            pickupRequired: dto.pickupRequired ?? false,
            maxPartySize: dto.maxPartySize ?? null,
            minPartySize: dto.minPartySize ?? 1,
            bookingCutoffMinutes: dto.bookingCutoffMinutes ?? 120,
            // Master rule #20 / §6.2 - free-cancellation window, enum-bound, default 48.
            cancellationHours: dto.cancellationHours ?? 48,
            startTimes: dto.startTimes ?? [],
            ...(dto.instantConfirmation !== undefined && {
              instantConfirmation: dto.instantConfirmation,
            }),
            ...(dto.paymentModel !== undefined && {
              paymentModel: dto.paymentModel,
            }),
            bookingType: dto.bookingType ?? null,
            meetingPointLat: dto.meetingPointLat ?? null,
            meetingPointLng: dto.meetingPointLng ?? null,
            checkInMinutesBefore: dto.checkInMinutesBefore ?? 30,
            departureCity: dto.departureCity ?? null,
            minAgeYears: dto.minAgeYears ?? null,
            fitnessLevel: dto.fitnessLevel ?? null,
            ...(dto.weatherDependent !== undefined && {
              weatherDependent: dto.weatherDependent,
            }),
            ...(dto.wheelchairAccessible !== undefined && {
              wheelchairAccessible: dto.wheelchairAccessible,
            }),
            ...(dto.familyFriendly !== undefined && {
              familyFriendly: dto.familyFriendly,
            }),
            ...(dto.suitableForBeginners !== undefined && {
              suitableForBeginners: dto.suitableForBeginners,
            }),
            reference: dto.reference ?? null,
            ogImage: dto.ogImage ?? null,
            availabilityConfirmedAt: dto.availabilityConfirmedAt
              ? new Date(dto.availabilityConfirmedAt)
              : null,
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
          select: this.tourSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            // Race-condition fallback: slug was taken between our pre-check and the write.
            throw new ConflictException(
              `Slug "${slug}" was taken concurrently. Please retry.`,
            );
          }
          throw err;
        });

      // Clear any cooled-down ghost row occupying this slug (reusable after the 90-day cooldown).
      await clearCooledDownSlugs(tx, [
        { destinationSlug: destination.slug, slug: tour.slug },
      ]);

      // V2 §5: every tour gets a flat /{destination}/{tour-slug}/ slug_registry TOUR row.
      await tx.slugRegistry
        .create({
          data: {
            destinationSlug: destination.slug,
            slug: tour.slug,
            entityType: SlugEntityType.TOUR,
            entityId: tour.id,
            isActive: true,
          },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Slug "${slug}" is already taken at destination "${destination.slug}"`,
            );
          }
          throw err;
        });

      this.logger.log(
        `Operator ${operatorId} created tour "${dto.name}" (${tour.id})`,
      );
      return this.flattenTour(tour);
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────────

  async update(
    id: string,
    dto: UpdateTourDto,
    requesterId: string,
    requesterRole: Role,
  ) {
    const tour = await this.findTourOrThrow(id);
    await this.assertOwnership(tour, requesterId, requesterRole);

    if (tour.status === TourStatus.ARCHIVED) {
      throw new BadRequestException('Cannot update an archived tour');
    }

    const warnings: string[] = [];

    // Validate category set if a replacement was supplied.
    let categoryIds: string[] | undefined;
    let primaryCategoryId: string | undefined;
    if (dto.categoryIds !== undefined) {
      categoryIds = [...new Set(dto.categoryIds)];
      if (categoryIds.length === 0)
        throw new BadRequestException('At least one category is required');
      primaryCategoryId = dto.primaryCategoryId ?? categoryIds[0];
      if (!categoryIds.includes(primaryCategoryId)) {
        throw new BadRequestException(
          'primaryCategoryId must be one of categoryIds',
        );
      }
      const found = await this.prisma.category.findMany({
        where: { id: { in: categoryIds }, isActive: true },
        select: { id: true },
      });
      if (found.length !== categoryIds.length) {
        throw new BadRequestException(
          'One or more categories not found or not active',
        );
      }
    }
    const hubIds =
      dto.hubIds !== undefined ? [...new Set(dto.hubIds)] : undefined;

    // ── Slug rename → 301 redirect + 90-day cooldown (master slug-registry rules) ──
    // Resolve the rename target up-front (cooldown-aware, excluding this tour's own row).
    let renameFrom: string | undefined;
    let renameTo: string | undefined;
    if (dto.slug !== undefined) {
      const normalized = generateSlug(dto.slug);
      if (normalized !== tour.slug) {
        const dest = await this.prisma.destination.findUnique({
          where: { id: tour.destinationId },
          select: { slug: true },
        });
        if (!dest) throw new BadRequestException('Tour destination not found');

        const slugTourConflict = await this.prisma.tour.findFirst({
          where: {
            destinationId: tour.destinationId,
            slug: normalized,
            id: { not: id },
          },
          select: { id: true },
        });
        const registryTaken = await isSlugTaken(
          this.prisma,
          dest.slug,
          normalized,
          id,
        );
        if (slugTourConflict || registryTaken) {
          throw new ConflictException(
            `Slug "${normalized}" is already taken at this destination`,
          );
        }
        renameFrom = tour.slug;
        renameTo = normalized;
      }
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      // Apply the slug rename inside the transaction: re-point the TOUR registry row,
      // record the 301, and collapse chains (master slug-registry rules).
      if (renameTo && renameFrom) {
        await renameEntitySlug(tx, {
          entityType: SlugEntityType.TOUR,
          entityId: id,
          fromSlug: renameFrom,
          toSlug: renameTo,
        });
      }

      await tx.tour.update({
        where: { id },
        data: {
          ...(renameTo && { slug: renameTo }),
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.pricingModel !== undefined && {
            pricingModel: dto.pricingModel,
          }),
          ...(dto.wholeUnitType !== undefined && {
            wholeUnitType: dto.wholeUnitType,
          }),
          ...(dto.defaultCurrency !== undefined && {
            defaultCurrency: dto.defaultCurrency,
          }),
          ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
          ...(dto.durationMinutesFrom !== undefined && {
            durationMinutesFrom: dto.durationMinutesFrom,
          }),
          ...(dto.durationMinutesTo !== undefined && {
            durationMinutesTo: dto.durationMinutesTo,
          }),
          ...(dto.pickupModel !== undefined && {
            pickupModel: dto.pickupModel,
          }),
          ...(dto.pickupRequired !== undefined && {
            pickupRequired: dto.pickupRequired,
          }),
          ...(dto.maxPartySize !== undefined && {
            maxPartySize: dto.maxPartySize,
          }),
          ...(dto.minPartySize !== undefined && {
            minPartySize: dto.minPartySize,
          }),
          ...(dto.bookingCutoffMinutes !== undefined && {
            bookingCutoffMinutes: dto.bookingCutoffMinutes,
          }),
          ...(dto.cancellationHours !== undefined && {
            cancellationHours: dto.cancellationHours,
          }),
          ...(dto.startTimes !== undefined && { startTimes: dto.startTimes }),
          ...(dto.paymentModel !== undefined && {
            paymentModel: dto.paymentModel,
          }),
          ...(dto.instantConfirmation !== undefined && {
            instantConfirmation: dto.instantConfirmation,
          }),
          ...(dto.bookingType !== undefined && {
            bookingType: dto.bookingType,
          }),
          ...(dto.meetingPointLat !== undefined && {
            meetingPointLat: dto.meetingPointLat,
          }),
          ...(dto.meetingPointLng !== undefined && {
            meetingPointLng: dto.meetingPointLng,
          }),
          ...(dto.checkInMinutesBefore !== undefined && {
            checkInMinutesBefore: dto.checkInMinutesBefore,
          }),
          ...(dto.departureCity !== undefined && {
            departureCity: dto.departureCity,
          }),
          ...(dto.minAgeYears !== undefined && {
            minAgeYears: dto.minAgeYears,
          }),
          ...(dto.fitnessLevel !== undefined && {
            fitnessLevel: dto.fitnessLevel,
          }),
          ...(dto.weatherDependent !== undefined && {
            weatherDependent: dto.weatherDependent,
          }),
          ...(dto.wheelchairAccessible !== undefined && {
            wheelchairAccessible: dto.wheelchairAccessible,
          }),
          ...(dto.familyFriendly !== undefined && {
            familyFriendly: dto.familyFriendly,
          }),
          ...(dto.suitableForBeginners !== undefined && {
            suitableForBeginners: dto.suitableForBeginners,
          }),
          ...(dto.isLocalsFavourite !== undefined && {
            isLocalsFavourite: dto.isLocalsFavourite,
          }),
          ...(dto.reference !== undefined && { reference: dto.reference }),
          ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
          ...(dto.availabilityConfirmedAt !== undefined && {
            availabilityConfirmedAt: new Date(dto.availabilityConfirmedAt),
          }),
          ...(dto.h1Override !== undefined && { h1Override: dto.h1Override }),
          ...(dto.breadcrumbLabel !== undefined && {
            breadcrumbLabel: dto.breadcrumbLabel,
          }),
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
          where: {
            tourId_categoryId: {
              tourId: id,
              categoryId: dto.primaryCategoryId,
            },
          },
          select: { id: true },
        });
        if (!existing)
          throw new BadRequestException(
            'primaryCategoryId must be one of the tour categories',
          );
        await tx.tourCategory.updateMany({
          where: { tourId: id },
          data: { isPrimary: false },
        });
        await tx.tourCategory.update({
          where: { id: existing.id },
          data: { isPrimary: true },
        });
      }

      // Replace the full hub set (validate destination + allowed-category).
      if (hubIds) {
        const effectiveCategoryIds =
          categoryIds ??
          (
            await tx.tourCategory.findMany({
              where: { tourId: id },
              select: { categoryId: true },
            })
          ).map((c) => c.categoryId);
        for (const hubId of hubIds) {
          const hub = await tx.hub.findUnique({
            where: { id: hubId },
            select: { id: true, destinationId: true, isActive: true },
          });
          if (!hub || !hub.isActive)
            throw new BadRequestException(
              `Hub ${hubId} not found or is not active`,
            );
          if (hub.destinationId !== tour.destinationId) {
            throw new BadRequestException(
              `Hub ${hubId} does not belong to the destination`,
            );
          }
          const allowedCount = await tx.hubAllowedCategory.count({
            where: { hubId, categoryId: { in: effectiveCategoryIds } },
          });
          if (allowedCount === 0) {
            throw new BadRequestException(
              `None of the tour's categories are allowed in hub ${hubId}`,
            );
          }
        }
        await tx.tourHub.deleteMany({ where: { tourId: id } });
        await tx.tourHub.createMany({
          data: hubIds.map((hubId) => ({ tourId: id, hubId })),
        });
      }

      return tx.tour.findUniqueOrThrow({
        where: { id },
        select: this.tourSelect,
      });
    });

    // Keep the "From $X" anchor in sync if basePrice changed.
    if (dto.basePrice !== undefined) {
      updated.priceFrom = await this.recomputePriceFrom(id);
    }

    this.logger.log(`User ${requesterId} updated tour ${id}`);
    return { tour: this.flattenTour(updated), warnings };
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────────

  async publish(id: string, userId: string, userRole: Role) {
    const tour = await this.prisma.tour.findUnique({
      where: { id },
      select: {
        ...this.tourSelect,
        images: { select: { id: true, isHero: true } },
        translations: {
          where: { locale: Locale.en },
          select: { overview: true },
        },
        _count: { select: { ageBands: true } },
      },
    });
    if (!tour) throw new NotFoundException(`Tour ${id} not found`);
    await this.assertOwnership(tour, userId, userRole);
    if (tour.status !== TourStatus.DRAFT) {
      throw new BadRequestException('Tour must be in DRAFT status to publish');
    }

    const errors: string[] = [];
    if (tour.images.length < 5)
      errors.push('At least 5 images are required to publish');
    if (!tour.images.some((img) => img.isHero))
      errors.push('A hero image must be set before publishing');

    const enTranslation = tour.translations[0];
    if (!enTranslation?.overview?.trim())
      errors.push('An English overview is required to publish');

    // Price required: either a flat basePrice or at least one priced age band.
    if (tour.basePrice == null && tour._count.ageBands === 0) {
      errors.push(
        'A price is required to publish (set a base price or add an age band)',
      );
    }

    if (errors.length > 0) throw new BadRequestException(errors);

    const updated = await this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.LIVE, publishedAt: new Date() },
      select: this.tourSelect,
    });

    this.logger.log(`User ${userId} published tour ${id}`);
    return this.flattenTour(updated);
  }

  async pause(id: string, userId: string, userRole: Role) {
    const tour = await this.findTourOrThrow(id);
    await this.assertOwnership(tour, userId, userRole);
    if (tour.status !== TourStatus.LIVE) {
      throw new BadRequestException('Tour must be LIVE to pause');
    }

    // Phase 5 hook: if tour holds a featured slot → SlotsService.releaseSlot()

    const updated = await this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.PAUSED },
      select: this.tourSelect,
    });

    this.logger.log(`User ${userId} paused tour ${id}`);
    return this.flattenTour(updated);
  }

  async unpause(id: string, userId: string, userRole: Role) {
    const tour = await this.findTourOrThrow(id);
    await this.assertOwnership(tour, userId, userRole);
    if (tour.status !== TourStatus.PAUSED) {
      throw new BadRequestException('Tour must be PAUSED to unpause');
    }

    const updated = await this.prisma.tour.update({
      where: { id },
      data: { status: TourStatus.LIVE },
      select: this.tourSelect,
    });

    this.logger.log(`User ${userId} unpaused tour ${id}`);
    return this.flattenTour(updated);
  }

  async archive(id: string, requesterId: string, requesterRole: Role) {
    const tour = await this.findTourOrThrow(id);
    await this.assertOwnership(tour, requesterId, requesterRole);

    if (tour.status === TourStatus.ARCHIVED) {
      throw new BadRequestException('Tour is already archived');
    }

    // Phase 5 hook: if tour holds a featured slot → SlotsService.releaseSlot()

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tour.update({
        where: { id },
        data: { status: TourStatus.ARCHIVED, isActive: false },
        select: this.tourSelect,
      });

      // Every tour has a flat TOUR slug_registry row → deactivate it (keeps the slug reserved).
      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.TOUR, entityId: id },
        data: { isActive: false },
      });

      this.logger.log(`User ${requesterId} archived tour ${id}`);
      return this.flattenTour(updated);
    });
  }

  async restore(id: string, requesterId: string, requesterRole: Role) {
    const tour = await this.findTourOrThrow(id);
    await this.assertOwnership(tour, requesterId, requesterRole);

    if (tour.status !== TourStatus.ARCHIVED) {
      throw new BadRequestException('Only ARCHIVED tours can be restored');
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.tour.update({
        where: { id },
        data: { status: TourStatus.DRAFT, isActive: true },
        select: this.tourSelect,
      });

      // Re-activate the flat TOUR slug_registry row.
      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.TOUR, entityId: id },
        data: { isActive: true },
      });

      this.logger.log(`User ${requesterId} restored tour ${id} to DRAFT`);
      return this.flattenTour(updated);
    });
  }

  async remove(id: string, userId: string, userRole: Role) {
    const tour = await this.findTourOrThrow(id);
    await this.assertOwnership(tour, userId, userRole);
    if (userRole !== Role.ADMIN && tour.status !== TourStatus.ARCHIVED) {
      throw new BadRequestException(
        'Only ARCHIVED tours can be permanently deleted. Archive the tour first.',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // Master slug-registry rule: hard delete starts the 90-day reuse cooldown. The TOUR
      // slug_registry row is kept (isActive=false, deletedAt=now) so the slug stays protected
      // and 404s until the cooldown elapses, after which create() can reuse it.
      await markSlugsDeleted(tx, SlugEntityType.TOUR, id);
      // Cascade deletes all child models (incl. TourCategory/TourHub) via onDelete: Cascade
      await tx.tour.delete({ where: { id } });
    });

    this.logger.log(`User ${userId} permanently deleted tour ${id}`);
    return { message: 'Tour permanently deleted' };
  }
}
