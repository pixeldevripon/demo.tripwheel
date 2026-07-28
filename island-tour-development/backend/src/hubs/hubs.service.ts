import { FAQ_PAGE_TYPE } from '@/common/constants/faq-page-type';
import { Locale } from '@/common/constants/locales';
import { FaqGroupService } from '@/common/faq/faq-group.service';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { TranslationClearMarkService } from '@/content-translation/translation-clear-mark.service';
import { translationUnitKeys } from '@/content-translation/translation-unit-keys';
import {
  CreateFaqGroupDto,
  UpdateFaqGroupDto,
  UpsertFaqTranslationDto,
} from '@/common/faq/dto/faq-group.dto';
import {
  applyTranslation,
  clearableField,
  faqSelect,
  mergeTranslation,
  orBase,
  resolveBlocksByPosition,
  resolveFaqLocale,
  resolveLocaleSet,
} from '@/common/utils/translation.util';
import { generateSlug } from '@/common/utils/slug.util';
import {
  clearCooledDownSlugs,
  isSlugTaken,
  renameEntitySlug,
} from '@/common/utils/slug-registry.util';
import { PrismaService } from '@/prisma/prisma.service';
import {
  DERIVED_ATTRIBUTE_KEYS,
  deriveTourAttributeMap,
  derivedAttributeTourSelect,
  type DerivedAttributeTour,
} from '@/attributes/derived-attributes';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  AttributeDataType,
  AvailabilityScheduleStatus,
  Currency,
  HubSectionType,
  HubStatus,
  Prisma,
  SlugEntityType,
  TourStatus,
} from '@prisma/client';
import { FxRatesService } from '@/fx/fx-rates.service';
import {
  ActiveHubsQueryDto,
  AddAllowedCategoryDto,
  CreateHubFaqDto,
  CreateHubDto,
  FaqLocaleQueryDto,
  HubBySlugQueryDto,
  HubQueryDto,
  HubRenderQueryDto,
  ReplaceContentSectionsDto,
  SetComparisonDto,
  SetOurPicksDto,
  UpdateHubFaqDto,
  UpdateHubDto,
  UpsertComparisonGroupTranslationDto,
  UpsertComparisonTourTranslationDto,
  UpsertHubPageContentDto,
  UpsertHubSectionTranslationDto,
  UpsertHubTranslationsDto,
  UpsertOurPickTranslationDto,
} from './dto/hub.dto';

@Injectable()
export class HubService {
  private readonly logger = new Logger(HubService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly faqGroups: FaqGroupService,
    private readonly fx: FxRatesService,
    private readonly contentTranslation: ContentTranslationEnqueuer,
    private readonly clearMarks: TranslationClearMarkService,
  ) {}

  /**
   * Attach a converted-price `money` object to a page of hub tour cards, in place
   * (guide §20.9). Mirrors ToursService.attachMoney: resolves each distinct source
   * currency's display rate once, converts each card, falls back to source currency
   * (rate 1) when no rate is available. The card's `currency` field is the source.
   */
  /** Attach the display `money` object to each hub card (guide §20.9). Delegates to
   *  the single reusable implementation in {@link FxRatesService.attachMoney}; hub
   *  cards hold their source currency in `currency`. */
  private async attachHubMoney(
    cards: Array<{
      currency: string;
      basePrice?: unknown;
      priceFrom?: unknown;
      money?: unknown;
    }>,
    target?: Currency,
  ): Promise<void> {
    await this.fx.attachMoney(cards, target, 'currency');
  }

  // Hub translation select including `heroTagline` (absent from the shared translationSelect util).
  private readonly hubTranslationSelect = {
    name: true,
    overview: true,
    heroTagline: true,
    h1Override: true,
    breadcrumbLabel: true,
    isMachineTranslated: true,
  } as const;

  private readonly hubSelect = {
    id: true,
    destinationId: true,
    name: true,
    slug: true,
    description: true,
    heroImage: true,
    ogImage: true,
    status: true,
    hubType: true,
    latitude: true,
    longitude: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  private readonly hubDetailSelect = {
    id: true,
    destinationId: true,
    name: true,
    slug: true,
    description: true,
    heroImage: true,
    ogImage: true,
    status: true,
    hubType: true,
    latitude: true,
    longitude: true,
    isSeeded: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
    allowedCategories: {
      select: {
        id: true,
        categoryId: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    },
  } as const;

  private readonly allowedCategorySelect = {
    id: true,
    categoryId: true,
    category: { select: { id: true, name: true, slug: true } },
  } as const;

  // ── Internal helpers ──────────────────────────────────────────────────────────

  private async findHubOrThrow(id: string) {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      select: this.hubSelect,
    });
    if (!hub) throw new NotFoundException(`Hub ${id} not found`);
    return hub;
  }

  /** Localized tour title with en fallback to the canonical name. */
  private tourTitle(tour: {
    name: string;
    translations: { title: string | null }[];
  }): string {
    return tour.translations[0]?.title ?? tour.name;
  }

  /**
   * Public tour-card fields shared by Our Picks and the comparison columns, so
   * both render decision-ready cards (price, rating, image, duration, pricing
   * model) instead of a bare {id, slug, title}. Mirrors the scalar shape of
   * `ToursService`'s public card select (prices stay raw Decimal, matching the
   * `/tours` listing). `translations` is added inline per call (locale-scoped).
   */
  /**
   * Card image set: hero first, then gallery order, capped - the card
   * hover-carousel needs the full set, not just the hero. Mirrors
   * ToursService.cardImagesArgs. Declared separately (not inside the outer
   * `as const`) because Prisma's orderBy inputs are mutable arrays.
   */
  private readonly cardTourImages = {
    select: { url: true, altText: true } as const,
    orderBy: [{ isHero: 'desc' as const }, { displayOrder: 'asc' as const }],
    take: 5 as const,
  };

  private readonly cardTourSelect = {
    id: true,
    slug: true,
    name: true,
    basePrice: true,
    priceFrom: true,
    defaultCurrency: true,
    pricingModel: true,
    wholeUnitType: true,
    aggregateRating: true,
    aggregateReviewCount: true,
    durationMinutesFrom: true,
    durationMinutesTo: true,
    bookingCount: true,
    images: this.cardTourImages,
  } as const;

  /** Map an enriched tour row (cardTourSelect + locale title) to a card summary. */
  private tourCard(tour: {
    id: string;
    slug: string;
    name: string;
    basePrice: unknown;
    priceFrom: unknown;
    defaultCurrency: string;
    pricingModel: unknown;
    wholeUnitType: unknown;
    aggregateRating: number | null;
    aggregateReviewCount: number;
    durationMinutesFrom: number | null;
    durationMinutesTo: number | null;
    bookingCount: number;
    images: { url: string; altText: string | null }[];
    translations: { title: string | null }[];
  }) {
    return {
      id: tour.id,
      slug: tour.slug,
      title: this.tourTitle(tour),
      heroImage: tour.images[0]?.url ?? null,
      heroImageAlt: tour.images[0]?.altText ?? null,
      // Full (capped) hero-first image set for the card hover-carousel.
      images: tour.images,
      basePrice: tour.basePrice,
      priceFrom: tour.priceFrom,
      currency: tour.defaultCurrency,
      pricingModel: tour.pricingModel,
      unitType: tour.wholeUnitType,
      rating: tour.aggregateRating,
      reviewCount: tour.aggregateReviewCount,
      durationMinutesFrom: tour.durationMinutesFrom,
      durationMinutesTo: tour.durationMinutesTo,
      bookingCount: tour.bookingCount,
    };
  }

  // ── Comparison-row derivation (auto from tour attributes) ───────────────────────

  /**
   * Load every column tour's attribute values once (two-query + in-memory join
   * by key - `TourAttribute` joins `AttributeDefinition` by string `key`, not a
   * DB relation). Attribute labels are NOT localized in this schema
   * (`displayName` is a single string), so there is no locale step.
   */
  private async loadTourAttributes(tourIds: string[]) {
    const attrsByTour = new Map<string, Map<string, string>>();
    if (tourIds.length === 0) return attrsByTour;

    const [rows, tours] = await Promise.all([
      this.prisma.tourAttribute.findMany({
        where: { tourId: { in: tourIds } },
        select: { tourId: true, attributeKey: true, attributeValue: true },
      }),
      this.prisma.tour.findMany({
        where: { id: { in: tourIds } },
        select: { id: true, ...derivedAttributeTourSelect },
      }),
    ]);

    // Stored values, minus derived keys (computed from the tour's fields below).
    for (const r of rows) {
      if (DERIVED_ATTRIBUTE_KEYS.has(r.attributeKey)) continue;
      let m = attrsByTour.get(r.tourId);
      if (!m) {
        m = new Map();
        attrsByTour.set(r.tourId, m);
      }
      m.set(r.attributeKey, r.attributeValue);
    }

    // Derived values (e.g. cancellation_window_hours, maximum_travelers) from the
    // tour's first-class fields - the single source of truth for the comparison rows.
    for (const t of tours) {
      let m = attrsByTour.get(t.id);
      if (!m) {
        m = new Map();
        attrsByTour.set(t.id, m);
      }
      for (const [key, value] of deriveTourAttributeMap(t)) {
        m.set(key, value);
      }
    }
    return attrsByTour;
  }

  private static parseMulti(raw: string | undefined): string[] {
    if (!raw) return [];
    try {
      const arr: unknown = JSON.parse(raw);
      return Array.isArray(arr) ? arr.map((v) => String(v)) : [raw];
    } catch {
      return [raw];
    }
  }

  private static titleCaseWords(v: string): string {
    return v
      .split('_')
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  /**
   * Fixed comparison template (Figma node 48047:5005). Six curated rows in a set
   * order, each formatted for the boat-tour design: composite "Boat & group"
   * (name + capacity), "Free cancel" as `48h`, "Open bar" as a green-check
   * "Included" vs plain "Optional", and so on. The editorial "What stands out"
   * row + the price/book footer are composed on the frontend from each column's
   * standoutNote/price. `check: true` renders a leading green check.
   */
  private static readonly COMPARISON_TEMPLATE: {
    key: string;
    label: string;
    dataType: AttributeDataType;
    build: (attrs: Map<string, string> | undefined) => {
      parts: string[];
      check: boolean | null;
    };
  }[] = [
    {
      key: 'island_facilities',
      label: 'On the island',
      dataType: AttributeDataType.ENUM_MULTI,
      build: (m) => ({
        parts: HubService.parseMulti(m?.get('island_facilities')),
        check: null,
      }),
    },
    {
      key: 'breakfast',
      label: 'Breakfast',
      dataType: AttributeDataType.BOOLEAN,
      build: (m) => ({
        parts: m?.get('breakfast_included') === 'true' ? ['Included'] : [],
        check: null,
      }),
    },
    {
      key: 'open_bar',
      label: 'Open bar',
      dataType: AttributeDataType.BOOLEAN,
      build: (m) => {
        const raw = m?.get('open_bar_included');
        if (raw === 'true') return { parts: ['Included'], check: true };
        if (raw === 'false') return { parts: ['Optional'], check: null };
        return { parts: [], check: null };
      },
    },
    {
      key: 'crossing',
      label: 'Crossing',
      dataType: AttributeDataType.TEXT,
      build: (m) => {
        const raw = m?.get('crossing_time');
        return { parts: raw ? [raw] : [], check: null };
      },
    },
    {
      key: 'boat_and_group',
      label: 'Boat & group',
      dataType: AttributeDataType.ENUM_MULTI,
      build: (m) => {
        const boatType = m?.get('boat_type');
        const name =
          m?.get('boat_name') ??
          (boatType ? HubService.titleCaseWords(boatType) : undefined);
        const max = m?.get('maximum_travelers');
        const parts: string[] = [];
        if (name) parts.push(name);
        if (max) parts.push(`max ${max}`);
        return { parts, check: null };
      },
    },
    {
      key: 'free_cancel',
      label: 'Free cancel',
      dataType: AttributeDataType.TEXT,
      build: (m) => {
        const raw = m?.get('cancellation_window_hours');
        return { parts: raw ? [`${raw}h`] : [], check: null };
      },
    },
  ];

  /**
   * Build the fixed six-row comparison for a group from the curated template.
   * A row is dropped only when NO column carries any value for it (so a non-boat
   * group never shows empty boat rows); rows are otherwise always emitted in
   * template order, even when every column matches (master 5.5 shows identical
   * "Breakfast: Included" cells).
   */
  private buildComparisonRows(
    orderedTourIds: string[],
    attrsByTour: Map<string, Map<string, string>>,
  ) {
    return HubService.COMPARISON_TEMPLATE.map((t) => ({
      key: t.key,
      label: t.label,
      dataType: t.dataType,
      cells: orderedTourIds.map((tid) => t.build(attrsByTour.get(tid))),
    })).filter((row) =>
      row.cells.some((c) => c.parts.length > 0 || c.check !== null),
    );
  }

  // ── Public CRUD ───────────────────────────────────────────────────────────────

  async getAll(query: HubQueryDto) {
    const {
      destinationId,
      isActive,
      page = 1,
      limit = 20,
      locale = Locale.en,
    } = query;
    const skip = (page - 1) * limit;

    const where = {
      ...(destinationId !== undefined && { destinationId }),
      ...(isActive !== undefined && { isActive }),
    };

    const [total, data] = await Promise.all([
      this.prisma.hub.count({ where }),
      this.prisma.hub.findMany({
        where,
        select: {
          ...this.hubSelect,
          translations: {
            where: { locale },
            select: { name: true, isMachineTranslated: true },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
    ]);

    const localizedData = data.map(({ translations, ...hub }) =>
      applyTranslation(hub, translations[0], locale),
    );

    return { total, page, limit, data: localizedData };
  }

  async getActive(query: ActiveHubsQueryDto) {
    const { destinationId, locale = Locale.en } = query;

    const data = await this.prisma.hub.findMany({
      where: {
        isActive: true,
        ...(destinationId !== undefined && { destinationId }),
      },
      select: {
        ...this.hubDetailSelect,
        translations: {
          where: { locale },
          select: { name: true, isMachineTranslated: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return data.map(({ translations, ...hub }) =>
      applyTranslation(hub, translations[0], locale),
    );
  }

  /**
   * Destination-scoped, tour-gated public hub list (mirrors the category
   * equivalent): only PUBLISHED + active hubs that have ≥1 LIVE tour tagged to
   * them, each with `publishedTourCount`. Backs the destination page's discovery
   * rows (hero "Popular" + "Explore by type") so every hub link resolves.
   */
  async getActiveByDestinationSlug(
    destinationSlug: string,
    locale: Locale = Locale.en,
  ) {
    const destination = await this.prisma.destination.findUnique({
      where: { slug: destinationSlug },
      select: { id: true, isActive: true },
    });
    if (!destination || !destination.isActive) {
      throw new NotFoundException(`Destination "${destinationSlug}" not found`);
    }

    const grouped = await this.prisma.tourHub.groupBy({
      by: ['hubId'],
      where: {
        tour: {
          destinationId: destination.id,
          status: TourStatus.LIVE,
          isActive: true,
        },
      },
      _count: { _all: true },
    });
    const countByHub = new Map(grouped.map((g) => [g.hubId, g._count._all]));
    const hubIds = [...countByHub.keys()];
    if (hubIds.length === 0) return [];

    const hubs = await this.prisma.hub.findMany({
      where: {
        id: { in: hubIds },
        isActive: true,
        status: HubStatus.PUBLISHED,
      },
      select: {
        ...this.hubSelect,
        translations: {
          where: { locale },
          select: { name: true, isMachineTranslated: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return hubs.map(({ translations, ...hub }) => ({
      ...applyTranslation(hub, translations[0], locale),
      publishedTourCount: countByHub.get(hub.id) ?? 0,
    }));
  }

  async getById(id: string, locale: Locale = Locale.en) {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      select: {
        ...this.hubDetailSelect,
        // Both locales: the merge below needs English to fall back to.
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: { locale: true, ...this.hubTranslationSelect },
        },
      },
    });

    if (!hub) throw new NotFoundException(`Hub ${id} not found`);

    const { translations, ...hubData } = hub;
    const t = mergeTranslation(translations, locale);

    return {
      ...applyTranslation(hubData, t, locale),
      overview: t?.overview ?? null,
      heroTagline: t?.heroTagline ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async getBySlug(slug: string, query: HubBySlugQueryDto) {
    const locale = query.locale ?? Locale.en;

    // Public endpoint: unpublished and deactivated hubs must 404 here exactly as
    // they do in `render`. Admin surfaces read hubs by id, not by slug.
    const hub = await this.prisma.hub.findFirst({
      where: {
        slug,
        destination: { slug: query.destinationSlug },
        isActive: true,
        status: HubStatus.PUBLISHED,
      },
      select: {
        ...this.hubDetailSelect,
        // Both locales: the merge below needs English to fall back to.
        translations: {
          where: { locale: { in: [locale, Locale.en] } },
          select: { locale: true, ...this.hubTranslationSelect },
        },
      },
    });

    if (!hub) {
      throw new NotFoundException(
        `Hub "${slug}" not found for destination "${query.destinationSlug}"`,
      );
    }

    const { translations, ...hubData } = hub;
    const t = mergeTranslation(translations, locale);

    return {
      ...applyTranslation(hubData, t, locale),
      overview: t?.overview ?? null,
      heroTagline: t?.heroTagline ?? null,
      h1Override: t?.h1Override ?? null,
      breadcrumbLabel: t?.breadcrumbLabel ?? null,
    };
  }

  async create(dto: CreateHubDto, adminId: string) {
    const slug = generateSlug(dto.name);

    return this.prisma.$transaction(async (tx) => {
      const destination = await tx.destination.findUnique({
        where: { id: dto.destinationId },
        select: { slug: true },
      });
      if (!destination) {
        throw new NotFoundException(
          `Destination ${dto.destinationId} not found`,
        );
      }

      const hub = await tx.hub
        .create({
          data: {
            destinationId: dto.destinationId,
            name: dto.name,
            slug,
            description: dto.description,
            heroImage: dto.heroImage ?? null,
            ogImage: dto.ogImage ?? null,
            ...(dto.status !== undefined && { status: dto.status }),
            hubType: dto.hubType,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            createdBy: adminId,
          },
          select: { id: true },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Hub slug "${slug}" already exists for this destination`,
            );
          }
          throw err;
        });

      // Clear any cooled-down ghost so a previously deleted hub slug can be reused.
      await clearCooledDownSlugs(tx, [
        { destinationSlug: destination.slug, slug },
      ]);

      await tx.slugRegistry
        .create({
          data: {
            destinationSlug: destination.slug,
            slug,
            entityType: SlugEntityType.HUB,
            entityId: hub.id,
          },
        })
        .catch((err: any) => {
          if (err?.code === 'P2002') {
            throw new ConflictException(
              `Slug "${slug}" is already taken for destination "${destination.slug}"`,
            );
          }
          throw err;
        });

      if (dto.allowedCategoryIds && dto.allowedCategoryIds.length > 0) {
        await tx.hubAllowedCategory.createMany({
          data: dto.allowedCategoryIds.map((categoryId) => ({
            hubId: hub.id,
            categoryId,
          })),
          skipDuplicates: true,
        });
      }

      this.logger.log(
        `Admin ${adminId} created hub "${dto.name}" (${hub.id}) for destination ${dto.destinationId}`,
      );

      return tx.hub.findUniqueOrThrow({
        where: { id: hub.id },
        select: this.hubDetailSelect,
      });
    });
  }

  async update(id: string, dto: UpdateHubDto, adminId: string) {
    // Resolve a slug rename up-front (cooldown-aware, master slug-registry rules).
    let renameFrom: string | undefined;
    let renameTo: string | undefined;
    if (dto.slug !== undefined) {
      const current = await this.prisma.hub.findUnique({
        where: { id },
        select: { slug: true, destination: { select: { slug: true } } },
      });
      if (!current) throw new NotFoundException(`Hub ${id} not found`);
      const normalized = generateSlug(dto.slug);
      if (normalized !== current.slug) {
        if (
          await isSlugTaken(
            this.prisma,
            current.destination.slug,
            normalized,
            id,
          )
        ) {
          throw new ConflictException(
            `Slug "${normalized}" is already taken for this destination`,
          );
        }
        renameFrom = current.slug;
        renameTo = normalized;
      }
    }

    // Publish guard (G6): DRAFT -> PUBLISHED must satisfy the listing requirements.
    if (dto.status === HubStatus.PUBLISHED) {
      await this.assertPublishable(id, dto);
    }

    return this.prisma.$transaction(async (tx) => {
      if (renameTo && renameFrom) {
        await renameEntitySlug(tx, {
          entityType: SlugEntityType.HUB,
          entityId: id,
          fromSlug: renameFrom,
          toSlug: renameTo,
        });
      }

      const updated = await tx.hub
        .update({
          where: { id },
          data: {
            ...(renameTo && { slug: renameTo }),
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.description !== undefined && {
              description: dto.description,
            }),
            ...(dto.heroImage !== undefined && { heroImage: dto.heroImage }),
            ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
            ...(dto.status !== undefined && { status: dto.status }),
            ...(dto.hubType !== undefined && { hubType: dto.hubType }),
            ...(dto.latitude !== undefined && { latitude: dto.latitude }),
            ...(dto.longitude !== undefined && { longitude: dto.longitude }),
            ...(dto.isActive !== undefined && { isActive: dto.isActive }),
          },
          select: this.hubDetailSelect,
        })
        .catch((err: any) => {
          if (err?.code === 'P2025')
            throw new NotFoundException(`Hub ${id} not found`);
          throw err;
        });

      if (dto.isActive !== undefined) {
        await tx.slugRegistry.updateMany({
          where: { entityType: SlugEntityType.HUB, entityId: id },
          data: { isActive: dto.isActive },
        });
      }

      this.logger.log(`Admin ${adminId} updated hub ${id}`);

      return updated;
    });
  }

  /**
   * Publish guard (HUB-DATA §14 G6). A hub may go PUBLISHED only when:
   *  - heroImage is set (incoming dto value or stored),
   *  - hubType is set,
   *  - base-locale (en) H1 override + overview (editorial lead) exist,
   *  - at least one en DISCOVER and one en LOCAL_TIP content section exist.
   * Throws 422 with the full missing-list otherwise.
   */
  private async assertPublishable(
    id: string,
    dto: UpdateHubDto,
  ): Promise<void> {
    const hub = await this.prisma.hub.findUnique({
      where: { id },
      select: { heroImage: true, hubType: true },
    });
    if (!hub) throw new NotFoundException(`Hub ${id} not found`);

    const [enTranslation, discoverCount, localTipCount] = await Promise.all([
      this.prisma.hubTranslation.findUnique({
        where: { hubId_locale: { hubId: id, locale: Locale.en } },
        select: { h1Override: true, overview: true },
      }),
      this.prisma.hubContentSection.count({
        where: {
          hubId: id,
          locale: Locale.en,
          sectionType: HubSectionType.DISCOVER,
        },
      }),
      this.prisma.hubContentSection.count({
        where: {
          hubId: id,
          locale: Locale.en,
          sectionType: HubSectionType.LOCAL_TIP,
        },
      }),
    ]);

    const heroImage = dto.heroImage ?? hub.heroImage;
    const hubType = dto.hubType ?? hub.hubType;

    const missing: string[] = [];
    if (!heroImage) missing.push('heroImage');
    if (!hubType) missing.push('hubType');
    if (!enTranslation?.h1Override) missing.push('English (en) H1 override');
    if (!enTranslation?.overview)
      missing.push('English (en) overview (editorial lead)');
    if (discoverCount === 0)
      missing.push('at least one English (en) DISCOVER content section');
    if (localTipCount === 0)
      missing.push('at least one English (en) LOCAL_TIP content section');

    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        message:
          'Hub cannot be published until all listing requirements are met.',
        missing,
      });
    }
  }

  async remove(id: string, adminId: string) {
    const hub = await this.findHubOrThrow(id);

    if (hub.isSeeded) {
      throw new ForbiddenException('Seeded hubs cannot be deactivated');
    }

    await this.prisma.$transaction(async (tx) => {
      const tripCount = await tx.tour.count({
        where: {
          hubs: { some: { hubId: id } },
          isActive: true,
          status: { not: TourStatus.DRAFT },
        },
      });
      if (tripCount > 0) {
        throw new ConflictException(
          `Cannot deactivate hub: ${tripCount} active trip(s) are still assigned to it`,
        );
      }

      await tx.hub.update({ where: { id }, data: { isActive: false } });

      await tx.slugRegistry.updateMany({
        where: { entityType: SlugEntityType.HUB, entityId: id },
        data: { isActive: false },
      });
    });

    this.logger.log(`Admin ${adminId} deactivated hub ${id}`);

    return { message: 'Hub deactivated successfully' };
  }

  // ── Allowed categories ────────────────────────────────────────────────────────

  async getAllowedCategories(id: string) {
    await this.findHubOrThrow(id);

    return this.prisma.hubAllowedCategory.findMany({
      where: { hubId: id },
      select: this.allowedCategorySelect,
      orderBy: { category: { name: 'asc' } },
    });
  }

  async addAllowedCategory(
    hubId: string,
    dto: AddAllowedCategoryDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(hubId);

    const category = await this.prisma.category.findUnique({
      where: { id: dto.categoryId },
      select: { id: true, name: true },
    });
    if (!category)
      throw new NotFoundException(`Category ${dto.categoryId} not found`);

    const allowedCategory = await this.prisma.hubAllowedCategory
      .create({
        data: { hubId, categoryId: dto.categoryId },
        select: this.allowedCategorySelect,
      })
      .catch((err: any) => {
        if (err?.code === 'P2002') {
          throw new ConflictException(
            `Category "${category.name}" is already allowed for this hub`,
          );
        }
        throw err;
      });

    this.logger.log(
      `Admin ${adminId} added allowed category ${dto.categoryId} to hub ${hubId}`,
    );

    return {
      message: 'Allowed category added successfully',
      allowedCategory,
    };
  }

  async removeAllowedCategory(
    hubId: string,
    categoryId: string,
    adminId: string,
  ) {
    await this.findHubOrThrow(hubId);

    const existing = await this.prisma.hubAllowedCategory.findUnique({
      where: { hubId_categoryId: { hubId, categoryId } },
    });
    if (!existing) {
      throw new NotFoundException(
        `Category ${categoryId} is not in the allowed list for hub ${hubId}`,
      );
    }

    await this.prisma.hubAllowedCategory.delete({
      where: { hubId_categoryId: { hubId, categoryId } },
    });

    this.logger.log(
      `Admin ${adminId} removed allowed category ${categoryId} from hub ${hubId}`,
    );

    return { message: 'Allowed category removed successfully' };
  }

  // ── Translations ──────────────────────────────────────────────────────────────

  async getAllTranslations(id: string) {
    await this.findHubOrThrow(id);

    return this.prisma.hubTranslation.findMany({
      where: { hubId: id },
      select: { locale: true, ...this.hubTranslationSelect },
      orderBy: { locale: 'asc' },
    });
  }

  async getTranslationsByLocale(id: string, locale: Locale) {
    await this.findHubOrThrow(id);

    const translation = await this.prisma.hubTranslation.findUnique({
      where: { hubId_locale: { hubId: id, locale } },
      select: { locale: true, ...this.hubTranslationSelect },
    });

    return (
      translation ?? {
        locale,
        name: null,
        overview: null,
        heroTagline: null,
        h1Override: null,
        breadcrumbLabel: null,
        isMachineTranslated: false,
      }
    );
  }

  async upsertTranslations(
    id: string,
    locale: Locale,
    dto: UpsertHubTranslationsDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);

    const { fields, isMachineTranslated } = dto;

    const result = await this.prisma.hubTranslation.upsert({
      where: { hubId_locale: { hubId: id, locale } },
      create: {
        hubId: id,
        locale,
        isMachineTranslated: isMachineTranslated ?? false,
        name: fields.name,
        overview: fields.overview,
        heroTagline: fields.heroTagline,
        h1Override: fields.h1Override,
        breadcrumbLabel: fields.breadcrumbLabel,
      },
      update: {
        isMachineTranslated: isMachineTranslated ?? false,
        // Human write path: reset the AI bookkeeping so the machine refresher
        // never overwrites what was typed here.
        sourceHash: null,
        ...(fields.name !== undefined && { name: fields.name }),
        ...(fields.overview !== undefined && { overview: fields.overview }),
        ...(fields.heroTagline !== undefined && {
          heroTagline: fields.heroTagline,
        }),
        ...(fields.h1Override !== undefined && {
          h1Override: fields.h1Override,
        }),
        ...(fields.breadcrumbLabel !== undefined && {
          breadcrumbLabel: fields.breadcrumbLabel,
        }),
      },
      select: { locale: true, ...this.hubTranslationSelect },
    });

    this.logger.log(
      `Admin ${adminId} upserted translation for hub ${id} [${locale}]`,
    );
    // An English edit re-sources the other locales.
    if (locale === Locale.en) this.contentTranslation.enqueue('hub', id);
    return result;
  }

  async deleteTranslations(id: string, locale: Locale, adminId: string) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'The English translation cannot be deleted. Update the hub name field instead.',
      );
    }

    await this.findHubOrThrow(id);

    await this.prisma.hubTranslation
      .delete({ where: { hubId_locale: { hubId: id, locale } } })
      .catch((err: any) => {
        if (err?.code === 'P2025') {
          throw new NotFoundException(
            `No translation found for locale "${locale}"`,
          );
        }
        throw err;
      });

    // A whole-locale delete is the broadest possible clear - mark it so the
    // AI treats the absent row as deliberate, not as untranslated.
    await this.clearMarks.mark(
      'hub',
      id,
      translationUnitKeys.main(),
      locale,
      adminId,
    );

    this.logger.log(
      `Admin ${adminId} deleted translation for hub ${id} [${locale}]`,
    );
    return { message: `Translation for locale "${locale}" deleted` };
  }

  // ── Page Content ──────────────────────────────────────────────────────────────

  /**
   * `fallback` is the public read: fill blanks from English so a page never
   * renders an empty About band. The dashboard editor leaves it off and gets
   * the locale exactly as stored - anything else would have an admin edit
   * English text inside a Dutch box and save it as Dutch.
   */
  async getPageContent(id: string, locale: Locale, fallback = false) {
    await this.findHubOrThrow(id);

    const rows = await this.prisma.hubPageContent.findMany({
      where: {
        hubId: id,
        locale: fallback ? { in: [locale, Locale.en] } : locale,
      },
      select: {
        locale: true,
        aboutText: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    const row = fallback
      ? mergeTranslation(rows, locale)
      : rows.find((r) => r.locale === locale);
    return (
      row ?? { locale, aboutText: null, metaTitle: null, metaDescription: null }
    );
  }

  async upsertPageContent(
    id: string,
    locale: Locale,
    dto: UpsertHubPageContentDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);

    const result = await this.prisma.hubPageContent.upsert({
      where: { hubId_locale: { hubId: id, locale } },
      create: {
        hubId: id,
        locale,
        aboutText: dto.aboutText,
        metaTitle: dto.metaTitle,
        metaDescription: dto.metaDescription,
      },
      update: {
        // Human write path - reset the AI bookkeeping (see upsertTranslations).
        isMachineTranslated: false,
        sourceHash: null,
        ...(dto.aboutText !== undefined && { aboutText: dto.aboutText }),
        ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
        ...(dto.metaDescription !== undefined && {
          metaDescription: dto.metaDescription,
        }),
      },
      select: {
        locale: true,
        aboutText: true,
        metaTitle: true,
        metaDescription: true,
      },
    });

    this.logger.log(
      `Admin ${adminId} upserted page content for hub ${id} [${locale}]`,
    );
    if (locale === Locale.en) this.contentTranslation.enqueue('hub', id);
    return result;
  }

  // ── Content sections (Discover / Local Tips / Fast Facts / Editorial) ──────────

  private readonly contentSectionSelect = {
    locale: true,
    sectionType: true,
    heading: true,
    body: true,
    image: true,
    displayOrder: true,
  } as const;

  async getContentSections(id: string, locale?: Locale) {
    await this.findHubOrThrow(id);

    return this.prisma.hubContentSection.findMany({
      where: { hubId: id, ...(locale && { locale }) },
      select: this.contentSectionSelect,
      orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }],
    });
  }

  /**
   * Admin read-back for the Translation Console: EVERY stored locale, not just
   * one. The public `getContentSections` takes a `LocaleQueryDto` whose locale
   * DEFAULTS to `en`, so calling it without a locale silently returns English
   * only - the console then found no sibling row for the target locale, showed
   * every field blank, and made a save that had persisted correctly look like
   * it had vanished on reload. Mirrors `getOurPicksForEdit` /
   * `getComparisonForEdit`, which already exist for the same reason.
   */
  async getContentSectionsForEdit(id: string) {
    await this.findHubOrThrow(id);

    return this.prisma.hubContentSection.findMany({
      where: { hubId: id },
      select: this.contentSectionSelect,
      orderBy: [
        { sectionType: 'asc' },
        { displayOrder: 'asc' },
        { locale: 'asc' },
      ],
    });
  }

  /** Replace the hub's full set of content sections (delete-then-insert). */
  async replaceContentSections(
    id: string,
    dto: ReplaceContentSectionsDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);

    const sections = await this.prisma.$transaction(async (tx) => {
      // Replace-all wipes the AI bookkeeping with the rows, so machine rows
      // round-tripped UNCHANGED through the editor must keep their flag +
      // sourceHash - otherwise every tab save turns them "human" and stale
      // translations stop refreshing on English edits. Identity here is the
      // content itself: an identical (locale, type, heading, body) block is
      // the same block.
      const prior = await tx.hubContentSection.findMany({
        where: { hubId: id },
        select: {
          locale: true,
          sectionType: true,
          heading: true,
          body: true,
          isMachineTranslated: true,
          sourceHash: true,
        },
      });
      const priorFlags = new Map<
        string,
        { isMachineTranslated: boolean; sourceHash: string | null }
      >();
      // NUL-separated content key. Identical-content rows collapse to one
      // entry (last wins) - safe here because identical content means
      // identical restore semantics; do NOT copy this flat-map pattern
      // anywhere content is not itself the key (see setComparison).
      for (const s of prior) {
        priorFlags.set(
          `${s.locale}|${s.sectionType}|${s.heading}\u0000${s.body}`,
          {
            isMachineTranslated: s.isMachineTranslated,
            sourceHash: s.sourceHash,
          },
        );
      }

      await tx.hubContentSection.deleteMany({ where: { hubId: id } });

      if (dto.sections.length > 0) {
        await tx.hubContentSection.createMany({
          data: dto.sections.map((s) => ({
            hubId: id,
            locale: s.locale,
            sectionType: s.sectionType,
            heading: s.heading,
            body: s.body,
            image: s.image ?? null,
            displayOrder: s.displayOrder ?? 0,
            ...(priorFlags.get(
              `${s.locale}|${s.sectionType}|${s.heading}\u0000${s.body}`,
            ) ?? {}),
          })),
        });
      }

      return tx.hubContentSection.findMany({
        where: { hubId: id },
        select: this.contentSectionSelect,
        orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }],
      });
    });

    this.logger.log(
      `Admin ${adminId} replaced ${sections.length} content section(s) for hub ${id}`,
    );
    // English blocks may have changed - refresh the machine locales.
    this.contentTranslation.enqueue('hub', id);

    return { count: sections.length, sections };
  }

  // ── Our Picks ──────────────────────────────────────────────────────────────────

  /** Replace the hub's Our-Pick selections, including per-locale blurb translations. */
  async setOurPicks(id: string, dto: SetOurPicksDto, adminId: string) {
    await this.findHubOrThrow(id);

    // Validate referenced tours exist and belong to the same destination as the hub.
    if (dto.picks.length > 0) {
      const tourIds = dto.picks.map((p) => p.tourId);
      const hub = await this.prisma.hub.findUniqueOrThrow({
        where: { id },
        select: { destinationId: true },
      });
      const tours = await this.prisma.tour.findMany({
        where: { id: { in: tourIds }, destinationId: hub.destinationId },
        select: { id: true },
      });
      const found = new Set(tours.map((t) => t.id));
      const missing = tourIds.filter((tid) => !found.has(tid));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Tour(s) not found in this hub's destination: ${missing.join(', ')}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Replace-all recreates every translation row, wiping the AI
      // bookkeeping. A blurb that round-trips UNCHANGED through the editor is
      // the same translation - keep its machine flag + sourceHash (identity:
      // the pick's tour), or every save would freeze machine rows as "human"
      // and English edits would stop refreshing them.
      const prior = await tx.hubOurPick.findMany({
        where: { hubId: id },
        select: {
          tourId: true,
          translations: {
            select: {
              locale: true,
              description: true,
              isMachineTranslated: true,
              sourceHash: true,
            },
          },
        },
      });
      const priorFlags = new Map(
        prior.flatMap((p) =>
          p.translations.map(
            (t) => [`${p.tourId}|${t.locale}|${t.description}`, t] as const,
          ),
        ),
      );

      // Cascade removes child translations of the old rows.
      await tx.hubOurPick.deleteMany({ where: { hubId: id } });

      for (const pick of dto.picks) {
        const created = await tx.hubOurPick.create({
          data: {
            hubId: id,
            tourId: pick.tourId,
            pickType: pick.pickType,
            description: pick.description,
            displayOrder: pick.displayOrder ?? 0,
          },
          select: { id: true },
        });

        if (pick.translations && pick.translations.length > 0) {
          await tx.hubOurPickTranslation.createMany({
            data: pick.translations.map((t) => {
              const kept = priorFlags.get(
                `${pick.tourId}|${t.locale}|${t.description}`,
              );
              return {
                ourPickId: created.id,
                locale: t.locale,
                description: t.description,
                ...(kept
                  ? {
                      isMachineTranslated: kept.isMachineTranslated,
                      sourceHash: kept.sourceHash,
                    }
                  : {}),
              };
            }),
          });
        }
      }
    });

    this.logger.log(
      `Admin ${adminId} set ${dto.picks.length} Our-Pick(s) for hub ${id}`,
    );
    // English blurbs may have changed - refresh the machine locales.
    this.contentTranslation.enqueue('hub', id);

    return this.getOurPicks(id, Locale.en);
  }

  async getOurPicks(id: string, locale: Locale = Locale.en, target?: Currency) {
    await this.findHubOrThrow(id);

    const rows = await this.prisma.hubOurPick.findMany({
      where: { hubId: id },
      select: {
        id: true,
        pickType: true,
        description: true,
        displayOrder: true,
        translations: { where: { locale }, select: { description: true } },
        tour: {
          select: {
            ...this.cardTourSelect,
            translations: { where: { locale }, select: { title: true } },
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Boat type is a `tour_attributes` value (not a column), so batch-load it for
    // the pick tours and surface it on the card (Figma shows it under the title).
    const attrsByTour = await this.loadTourAttributes(
      rows.map((r) => r.tour.id),
    );

    const ourPicks = rows.map((r) => ({
      id: r.id,
      pickType: r.pickType,
      // `orBase`, not `??`: a CLEARED translation is stored as '' and must
      // fall back to the base English blurb, not render empty.
      description: orBase(r.translations[0]?.description, r.description),
      displayOrder: r.displayOrder,
      tour: {
        ...this.tourCard(r.tour),
        boatType: attrsByTour.get(r.tour.id)?.get('boat_type') ?? null,
      },
    }));

    await this.attachHubMoney(
      ourPicks.map((p) => p.tour),
      target,
    );
    return { count: ourPicks.length, ourPicks };
  }

  /**
   * Admin read-back for the Our Picks editor: returns each pick with its base
   * (en) blurb plus every stored per-locale translation, so the dashboard can
   * populate the locale tabs and round-trip all languages.
   */
  async getOurPicksForEdit(id: string) {
    await this.findHubOrThrow(id);

    const rows = await this.prisma.hubOurPick.findMany({
      where: { hubId: id },
      select: {
        id: true,
        tourId: true,
        pickType: true,
        description: true,
        displayOrder: true,
        translations: { select: { locale: true, description: true } },
        tour: { select: { name: true } },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return rows.map((r) => ({
      id: r.id,
      tourId: r.tourId,
      tourName: r.tour.name,
      pickType: r.pickType,
      displayOrder: r.displayOrder,
      description: r.description,
      translations: r.translations,
    }));
  }

  // ── Comparison ───────────────────────────────────────────────────────────────

  /** Replace the hub's comparison groups + tour columns, with per-locale labels/notes. */
  async setComparison(id: string, dto: SetComparisonDto, adminId: string) {
    await this.findHubOrThrow(id);

    // Validate referenced tours belong to the hub's destination.
    const tourIds = dto.groups.flatMap((g) => g.tours.map((t) => t.tourId));
    if (tourIds.length > 0) {
      const hub = await this.prisma.hub.findUniqueOrThrow({
        where: { id },
        select: { destinationId: true },
      });
      const tours = await this.prisma.tour.findMany({
        where: { id: { in: tourIds }, destinationId: hub.destinationId },
        select: { id: true },
      });
      const found = new Set(tours.map((t) => t.id));
      const missing = [...new Set(tourIds)].filter((tid) => !found.has(tid));
      if (missing.length > 0) {
        throw new BadRequestException(
          `Tour(s) not found in this hub's destination: ${missing.join(', ')}`,
        );
      }
    }

    await this.prisma.$transaction(async (tx) => {
      // Same flag preservation as setOurPicks: an unchanged translation
      // round-tripping the replace-all keeps its machine flag + sourceHash.
      // Identity: the group's English name / the column's tour.
      const priorGroups = await tx.hubComparisonGroup.findMany({
        where: { hubId: id },
        select: {
          groupName: true,
          translations: {
            select: {
              locale: true,
              groupName: true,
              isMachineTranslated: true,
              sourceHash: true,
            },
          },
          comparisonTours: {
            select: {
              tourId: true,
              translations: {
                select: {
                  locale: true,
                  standoutNote: true,
                  isMachineTranslated: true,
                  sourceHash: true,
                },
              },
            },
          },
        },
      });
      // Prior lookups are scoped PER GROUP (matched by English name), never
      // hub-wide: tourId is only unique within a group and group names carry
      // no uniqueness constraint, so a flat map would collide across groups
      // and could stamp one group's hand-written translation with another
      // group's machine flags.
      const priorByGroupName = new Map(
        priorGroups.map((g) => [g.groupName, g] as const),
      );
      const keep = (
        t:
          | { isMachineTranslated: boolean; sourceHash: string | null }
          | undefined,
      ) =>
        t
          ? {
              isMachineTranslated: t.isMachineTranslated,
              sourceHash: t.sourceHash,
            }
          : {};

      // Cascade removes comparison tours + all translations.
      await tx.hubComparisonGroup.deleteMany({ where: { hubId: id } });

      for (const group of dto.groups) {
        const priorGroup = priorByGroupName.get(group.groupName);
        const priorGroupFlags = new Map(
          (priorGroup?.translations ?? []).map(
            (t) => [`${t.locale}|${t.groupName}`, t] as const,
          ),
        );
        const priorTourFlags = new Map(
          (priorGroup?.comparisonTours ?? []).flatMap((ct) =>
            ct.translations.map(
              (t) => [`${ct.tourId}|${t.locale}|${t.standoutNote}`, t] as const,
            ),
          ),
        );

        const createdGroup = await tx.hubComparisonGroup.create({
          data: {
            hubId: id,
            groupName: group.groupName,
            displayOrder: group.displayOrder ?? 0,
          },
          select: { id: true },
        });

        if (group.translations && group.translations.length > 0) {
          await tx.hubComparisonGroupTranslation.createMany({
            data: group.translations.map((t) => ({
              groupId: createdGroup.id,
              locale: t.locale,
              groupName: t.groupName,
              ...keep(priorGroupFlags.get(`${t.locale}|${t.groupName}`)),
            })),
          });
        }

        for (const tour of group.tours) {
          const createdTour = await tx.hubComparisonTour.create({
            data: {
              groupId: createdGroup.id,
              tourId: tour.tourId,
              standoutNote: tour.standoutNote ?? null,
              displayOrder: tour.displayOrder ?? 0,
            },
            select: { id: true },
          });

          if (tour.translations && tour.translations.length > 0) {
            await tx.hubComparisonTourTranslation.createMany({
              data: tour.translations.map((t) => ({
                comparisonTourId: createdTour.id,
                locale: t.locale,
                standoutNote: t.standoutNote,
                ...keep(
                  priorTourFlags.get(
                    `${tour.tourId}|${t.locale}|${t.standoutNote}`,
                  ),
                ),
              })),
            });
          }
        }
      }
    });

    this.logger.log(
      `Admin ${adminId} set ${dto.groups.length} comparison group(s) for hub ${id}`,
    );
    // English names/notes may have changed - refresh the machine locales.
    this.contentTranslation.enqueue('hub', id);

    return this.getComparison(id, Locale.en);
  }

  async getComparison(
    id: string,
    locale: Locale = Locale.en,
    target?: Currency,
  ) {
    await this.findHubOrThrow(id);

    const groups = await this.prisma.hubComparisonGroup.findMany({
      where: { hubId: id },
      select: {
        id: true,
        groupName: true,
        displayOrder: true,
        translations: { where: { locale }, select: { groupName: true } },
        comparisonTours: {
          select: {
            id: true,
            standoutNote: true,
            displayOrder: true,
            translations: { where: { locale }, select: { standoutNote: true } },
            tour: {
              select: {
                ...this.cardTourSelect,
                translations: { where: { locale }, select: { title: true } },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    // Auto-derive comparison rows from the column tours' attributes (one load
    // for every tour across all groups).
    const allTourIds = [
      ...new Set(
        groups.flatMap((g) => g.comparisonTours.map((ct) => ct.tour.id)),
      ),
    ];
    const attrsByTour = await this.loadTourAttributes(allTourIds);

    const mapped = groups.map((g) => {
      const orderedTourIds = g.comparisonTours.map((ct) => ct.tour.id);
      return {
        id: g.id,
        groupName: orBase(g.translations[0]?.groupName, g.groupName),
        displayOrder: g.displayOrder,
        tours: g.comparisonTours.map((ct) => ({
          id: ct.id,
          displayOrder: ct.displayOrder,
          standoutNote:
            orBase(ct.translations[0]?.standoutNote, ct.standoutNote ?? '') ||
            null,
          tour: this.tourCard(ct.tour),
        })),
        rows: this.buildComparisonRows(orderedTourIds, attrsByTour),
      };
    });

    await this.attachHubMoney(
      mapped.flatMap((g) => g.tours.map((t) => t.tour)),
      target,
    );
    return { count: mapped.length, groups: mapped };
  }

  /**
   * Admin read-back for the comparison editor: returns each group + tour column
   * with its base (en) values plus every stored per-locale translation, so the
   * dashboard can populate the standout-note locale tabs and round-trip all
   * languages. Group-name translations are returned so they can be preserved on
   * the replace-all save even though the editor only edits standout notes.
   */
  async getComparisonForEdit(id: string) {
    await this.findHubOrThrow(id);

    const groups = await this.prisma.hubComparisonGroup.findMany({
      where: { hubId: id },
      select: {
        id: true,
        groupName: true,
        displayOrder: true,
        translations: { select: { locale: true, groupName: true } },
        comparisonTours: {
          select: {
            id: true,
            tourId: true,
            standoutNote: true,
            displayOrder: true,
            translations: { select: { locale: true, standoutNote: true } },
            tour: { select: { name: true } },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    return groups.map((g) => ({
      id: g.id,
      groupName: g.groupName,
      displayOrder: g.displayOrder,
      translations: g.translations,
      tours: g.comparisonTours.map((ct) => ({
        id: ct.id,
        tourId: ct.tourId,
        tourName: ct.tour.name,
        standoutNote: ct.standoutNote,
        displayOrder: ct.displayOrder,
        translations: ct.translations,
      })),
    }));
  }

  // ── Curation translation upserts (Translation Console per-item saves) ─────────
  // The structural editors save via the replace-all endpoints above; the
  // Translation Console edits ONE locale of ONE item through these, so a
  // console save can never race a concurrent structural edit into data loss.
  // All four are HUMAN write paths: non-en writes reset the machine
  // bookkeeping (the AI refresher must never overwrite them), en writes edit
  // the base source and re-enqueue the machine locales.

  async upsertOurPickTranslation(
    hubId: string,
    pickId: string,
    locale: Locale,
    dto: UpsertOurPickTranslationDto,
    adminId: string,
  ) {
    const pick = await this.prisma.hubOurPick.findFirst({
      where: { id: pickId, hubId },
      select: { id: true },
    });
    if (!pick) {
      throw new NotFoundException(
        `Our Pick with ID ${pickId} not found for this hub`,
      );
    }

    // Blank clears this locale (stored '', row kept) and the card falls back to
    // the base English blurb; English itself is refused.
    const description = clearableField(
      dto.description,
      locale,
      'The Our Pick rationale',
    );

    if (locale === Locale.en) {
      // en IS the base blurb on the pick row itself. Both writes stay scoped
      // to the hub (not just the PK) so a concurrent re-parent/replace can
      // never redirect them, and any stray en translation row is cleared -
      // public reads prefer the translation row, so a stray one would shadow
      // this edit.
      const [updated] = await this.prisma.$transaction([
        this.prisma.hubOurPick.updateMany({
          where: { id: pickId, hubId },
          data: { description },
        }),
        this.prisma.hubOurPickTranslation.deleteMany({
          where: { ourPickId: pickId, locale: Locale.en, ourPick: { hubId } },
        }),
      ]);
      if (updated.count === 0) {
        throw new NotFoundException(
          `Our Pick with ID ${pickId} not found for this hub`,
        );
      }
      this.logger.log(
        `Admin ${adminId} updated Our-Pick ${pickId} base blurb for hub ${hubId}`,
      );
      this.contentTranslation.enqueue('hub', hubId);
      return { locale, description: description };
    }

    const row = await this.prisma.hubOurPickTranslation.upsert({
      where: { ourPickId_locale: { ourPickId: pickId, locale } },
      update: {
        description: description,
        isMachineTranslated: false,
        sourceHash: null,
      },
      create: { ourPickId: pickId, locale, description: description },
      select: { locale: true, description: true },
    });
    this.logger.log(
      `Admin ${adminId} upserted Our-Pick ${pickId} translation [${locale}] for hub ${hubId}`,
    );
    return row;
  }

  async upsertComparisonGroupTranslation(
    hubId: string,
    groupId: string,
    locale: Locale,
    dto: UpsertComparisonGroupTranslationDto,
    adminId: string,
  ) {
    const group = await this.prisma.hubComparisonGroup.findFirst({
      where: { id: groupId, hubId },
      select: { id: true },
    });
    if (!group) {
      throw new NotFoundException(
        `Comparison group with ID ${groupId} not found for this hub`,
      );
    }

    // Blank clears this locale (stored '', row kept) - the table falls back to
    // the base English group name.
    const groupName = clearableField(
      dto.groupName,
      locale,
      'The comparison group name',
    );

    if (locale === Locale.en) {
      // Hub-scoped writes + stray en translation-row cleanup (same rationale
      // as upsertOurPickTranslation).
      const [updated] = await this.prisma.$transaction([
        this.prisma.hubComparisonGroup.updateMany({
          where: { id: groupId, hubId },
          data: { groupName },
        }),
        this.prisma.hubComparisonGroupTranslation.deleteMany({
          where: { groupId, locale: Locale.en, group: { hubId } },
        }),
      ]);
      if (updated.count === 0) {
        throw new NotFoundException(
          `Comparison group with ID ${groupId} not found for this hub`,
        );
      }
      this.logger.log(
        `Admin ${adminId} updated comparison group ${groupId} base name for hub ${hubId}`,
      );
      this.contentTranslation.enqueue('hub', hubId);
      return { locale, groupName };
    }

    const row = await this.prisma.hubComparisonGroupTranslation.upsert({
      where: { groupId_locale: { groupId, locale } },
      update: {
        groupName,
        isMachineTranslated: false,
        sourceHash: null,
      },
      create: { groupId, locale, groupName },
      select: { locale: true, groupName: true },
    });
    this.logger.log(
      `Admin ${adminId} upserted comparison group ${groupId} translation [${locale}] for hub ${hubId}`,
    );
    return row;
  }

  async upsertComparisonTourTranslation(
    hubId: string,
    comparisonTourId: string,
    locale: Locale,
    dto: UpsertComparisonTourTranslationDto,
    adminId: string,
  ) {
    const column = await this.prisma.hubComparisonTour.findFirst({
      where: { id: comparisonTourId, group: { hubId } },
      select: { id: true },
    });
    if (!column) {
      throw new NotFoundException(
        `Comparison tour column with ID ${comparisonTourId} not found for this hub`,
      );
    }

    // Blank clears this locale (stored '', row kept) - the column falls back to
    // the base English standout note.
    const standoutNote = clearableField(
      dto.standoutNote,
      locale,
      'The standout note',
    );

    if (locale === Locale.en) {
      // Hub-scoped writes + stray en translation-row cleanup (same rationale
      // as upsertOurPickTranslation).
      const [updated] = await this.prisma.$transaction([
        this.prisma.hubComparisonTour.updateMany({
          where: { id: comparisonTourId, group: { hubId } },
          data: { standoutNote },
        }),
        this.prisma.hubComparisonTourTranslation.deleteMany({
          where: {
            comparisonTourId,
            locale: Locale.en,
            comparisonTour: { group: { hubId } },
          },
        }),
      ]);
      if (updated.count === 0) {
        throw new NotFoundException(
          `Comparison tour column with ID ${comparisonTourId} not found for this hub`,
        );
      }
      this.logger.log(
        `Admin ${adminId} updated comparison tour ${comparisonTourId} base standout note for hub ${hubId}`,
      );
      this.contentTranslation.enqueue('hub', hubId);
      return { locale, standoutNote };
    }

    const row = await this.prisma.hubComparisonTourTranslation.upsert({
      where: { comparisonTourId_locale: { comparisonTourId, locale } },
      update: {
        standoutNote,
        isMachineTranslated: false,
        sourceHash: null,
      },
      create: { comparisonTourId, locale, standoutNote },
      select: { locale: true, standoutNote: true },
    });
    this.logger.log(
      `Admin ${adminId} upserted comparison tour ${comparisonTourId} translation [${locale}] for hub ${hubId}`,
    );
    return row;
  }

  /**
   * Clear ONE locale of a curation item (Translation Console). Every one of
   * these translation columns is NOT NULL, so a blank row cannot be stored:
   * deleting the row IS the cleared state and the public page falls back to
   * the base English value. English lives on the BASE row and is refused here.
   */
  async deleteOurPickTranslation(
    hubId: string,
    pickId: string,
    locale: Locale,
    adminId: string,
  ) {
    this.assertClearableLocale(locale, 'Our Pick rationale');
    const { count } = await this.prisma.hubOurPickTranslation.deleteMany({
      where: { ourPickId: pickId, locale, ourPick: { hubId } },
    });
    // NOT NULL copy - the clear removed the row, so the mark is what tells
    // the AI to leave this locale blank instead of re-creating it.
    await this.clearMarks.mark(
      'hub',
      hubId,
      translationUnitKeys.ourPick(pickId),
      locale,
      adminId,
    );

    this.logger.log(
      `Admin ${adminId} cleared Our-Pick ${pickId} translation [${locale}] for hub ${hubId}`,
    );
    return { message: count > 0 ? 'Translation cleared' : 'Nothing to clear' };
  }

  async deleteComparisonGroupTranslation(
    hubId: string,
    groupId: string,
    locale: Locale,
    adminId: string,
  ) {
    this.assertClearableLocale(locale, 'comparison group name');
    const { count } =
      await this.prisma.hubComparisonGroupTranslation.deleteMany({
        where: { groupId, locale, group: { hubId } },
      });
    // NOT NULL copy - the clear removed the row, so the mark is what tells
    // the AI to leave this locale blank instead of re-creating it.
    await this.clearMarks.mark(
      'hub',
      hubId,
      translationUnitKeys.comparisonGroup(groupId),
      locale,
      adminId,
    );

    this.logger.log(
      `Admin ${adminId} cleared comparison group ${groupId} translation [${locale}] for hub ${hubId}`,
    );
    return { message: count > 0 ? 'Translation cleared' : 'Nothing to clear' };
  }

  async deleteComparisonTourTranslation(
    hubId: string,
    comparisonTourId: string,
    locale: Locale,
    adminId: string,
  ) {
    this.assertClearableLocale(locale, 'standout note');
    const { count } = await this.prisma.hubComparisonTourTranslation.deleteMany(
      {
        where: {
          comparisonTourId,
          locale,
          comparisonTour: { group: { hubId } },
        },
      },
    );
    // NOT NULL copy - the clear removed the row, so the mark is what tells
    // the AI to leave this locale blank instead of re-creating it.
    await this.clearMarks.mark(
      'hub',
      hubId,
      translationUnitKeys.comparisonTour(comparisonTourId),
      locale,
      adminId,
    );

    this.logger.log(
      `Admin ${adminId} cleared comparison tour ${comparisonTourId} translation [${locale}] for hub ${hubId}`,
    );
    return { message: count > 0 ? 'Translation cleared' : 'Nothing to clear' };
  }

  /**
   * Content-section blocks fall back as a SET (`resolveLocaleSet`), not per
   * block: the public page uses the locale's blocks only if it has any at
   * all. So clearing one block's translation while its siblings stay
   * translated would drop that block from the page entirely rather than
   * showing it in English. Clearing is therefore all-or-nothing per
   * (locale, sectionType): the caller clears the block, and if it was the
   * last translated block of that type the whole type falls back to English.
   */
  async deleteContentSectionTranslation(
    hubId: string,
    sectionType: HubSectionType,
    displayOrder: number,
    locale: Locale,
    adminId: string,
  ) {
    this.assertClearableLocale(locale, 'content block');
    this.assertDisplayOrder(displayOrder);
    const { count } = await this.prisma.hubContentSection.deleteMany({
      where: { hubId, locale, sectionType, displayOrder },
    });
    // NOT NULL copy - the clear removed the row, so the mark is what tells
    // the AI to leave this locale blank instead of re-creating it.
    await this.clearMarks.mark(
      'hub',
      hubId,
      translationUnitKeys.hubSection(sectionType, displayOrder),
      locale,
      adminId,
    );

    this.logger.log(
      `Admin ${adminId} cleared ${sectionType} block #${displayOrder} translation [${locale}] for hub ${hubId}`,
    );
    return { message: count > 0 ? 'Translation cleared' : 'Nothing to clear' };
  }

  private assertClearableLocale(locale: Locale, label: string) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        `English is the source ${label} and cannot be cleared - edit it in the hub editor instead`,
      );
    }
  }

  /** Block positions are 0-based; this Nest's ParseIntPipe takes no bounds. */
  private assertDisplayOrder(displayOrder: number) {
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      throw new BadRequestException('displayOrder must be 0 or greater');
    }
  }

  async upsertContentSectionTranslation(
    hubId: string,
    sectionType: HubSectionType,
    displayOrder: number,
    locale: Locale,
    dto: UpsertHubSectionTranslationDto,
    adminId: string,
  ) {
    this.assertDisplayOrder(displayOrder);
    // Blocks have no FK group key - identity across locales is
    // (sectionType, displayOrder), anchored by the English source row.
    const enRow = await this.prisma.hubContentSection.findUnique({
      where: {
        hubId_locale_sectionType_displayOrder: {
          hubId,
          locale: Locale.en,
          sectionType,
          displayOrder,
        },
      },
      select: { id: true, image: true },
    });
    if (!enRow) {
      throw new NotFoundException(
        `No ${sectionType} block #${displayOrder} exists for this hub`,
      );
    }

    // Headingless block types (Discover Intro / Highlight) store the body
    // copied into `heading` - mirror it when no heading is sent (the same
    // convention the editor and the AI unit writer follow).
    // Heading and body clear independently in a translated locale: a blank
    // stores '' and keeps the row, so that field alone falls back to English.
    const body = clearableField(dto.body, locale, 'The block body');
    const heading =
      dto.heading === undefined
        ? body
        : clearableField(dto.heading, locale, 'The block heading');
    const select = {
      locale: true,
      sectionType: true,
      displayOrder: true,
      heading: true,
      body: true,
    } as const;

    if (locale === Locale.en) {
      const row = await this.prisma.hubContentSection.update({
        where: { id: enRow.id },
        data: { heading, body },
        select,
      });
      this.logger.log(
        `Admin ${adminId} updated ${sectionType} block #${displayOrder} base copy for hub ${hubId}`,
      );
      this.contentTranslation.enqueue('hub', hubId);
      return row;
    }

    const row = await this.prisma.hubContentSection.upsert({
      where: {
        hubId_locale_sectionType_displayOrder: {
          hubId,
          locale,
          sectionType,
          displayOrder,
        },
      },
      update: {
        heading,
        body,
        isMachineTranslated: false,
        sourceHash: null,
      },
      create: {
        hubId,
        locale,
        sectionType,
        displayOrder,
        heading,
        body,
        // The image is locale-neutral - siblings mirror the English row's.
        image: enRow.image,
      },
      select,
    });
    this.logger.log(
      `Admin ${adminId} upserted ${sectionType} block #${displayOrder} translation [${locale}] for hub ${hubId}`,
    );
    return row;
  }

  // ── Hero at-a-glance stats (computed, not editorial) ────────────────────────────

  /**
   * Compute the hero "meta pills" from the hub's LIVE tour set (master 5.5 - the
   * hero summarises the typical trip, not authored copy). Mirrors the public
   * `/tours?hubId=` filter exactly (`status=LIVE`, `isActive`, `isBookable`) so the
   * pills always agree with the trips grid below:
   *  - duration : min..max of the tours' duration range
   *  - priceFrom: cheapest `priceFrom` (fallback `basePrice`) across the set
   *  - frequencyDays: distinct ACTIVE departure weekdays across the whole set
   *    (0-7); the frontend renders 7 as "Daily", 1-6 as "N days a week"
   *
   * The inclusion/meal pill ("BBQ lunch") is NOT computed here - it is editorial
   * (a meal name is marketing copy, not derivable from tour data), so the frontend
   * reads it from `hero.fastFacts`.
   */
  private async computeHeroStats(hubId: string) {
    const tourWhere = {
      status: TourStatus.LIVE,
      isActive: true,
      isBookable: true,
      hubs: { some: { hubId } },
    } as const;

    const [tours, weekdays] = await Promise.all([
      this.prisma.tour.findMany({
        where: tourWhere,
        select: {
          id: true,
          durationMinutesFrom: true,
          durationMinutesTo: true,
          priceFrom: true,
          basePrice: true,
        },
      }),
      this.prisma.availabilitySchedule.findMany({
        where: {
          status: AvailabilityScheduleStatus.ACTIVE,
          tour: tourWhere,
        },
        select: { weekday: true },
        distinct: ['weekday'],
      }),
    ]);

    const durFrom = tours
      .map((t) => t.durationMinutesFrom)
      .filter((n): n is number => n != null);
    const durTo = tours
      .map((t) => t.durationMinutesTo ?? t.durationMinutesFrom)
      .filter((n): n is number => n != null);
    const prices = tours
      .map((t) => Number(t.priceFrom ?? t.basePrice ?? 0))
      .filter((n) => n > 0);

    return {
      durationMinutesFrom: durFrom.length ? Math.min(...durFrom) : null,
      durationMinutesTo: durTo.length ? Math.max(...durTo) : null,
      priceFrom: prices.length ? Math.min(...prices) : null,
      frequencyDays: weekdays.length,
      inclusion: await this.computeHeroInclusion(tours.map((t) => t.id)),
    };
  }

  // Amenity attributes the hero "inclusion" pill can surface, in display
  // priority (BBQ first, per Figma 48024:11162). The highest-priority amenity
  // present on ANY of the hub's live tours wins - a deterministic feature pick,
  // not a popularity contest, so BBQ headlines whenever the hub offers it.
  private static readonly HERO_AMENITY_PRIORITY = [
    'bbq_included',
    'beach_house_included',
    'open_bar_included',
    'breakfast_included',
  ];

  /**
   * The single amenity to feature in the hero's inclusion pill: the first key in
   * HERO_AMENITY_PRIORITY present on any of the hub's tours. Returns the attribute
   * key (e.g. 'bbq_included') or null when none apply.
   */
  private async computeHeroInclusion(
    tourIds: string[],
  ): Promise<string | null> {
    if (tourIds.length === 0) return null;
    const rows = await this.prisma.tourAttribute.groupBy({
      by: ['attributeKey'],
      where: {
        tourId: { in: tourIds },
        attributeKey: { in: HubService.HERO_AMENITY_PRIORITY },
        attributeValue: 'true',
      },
      _count: { attributeKey: true },
    });
    const present = new Set(rows.map((r) => r.attributeKey));
    return (
      HubService.HERO_AMENITY_PRIORITY.find((key) => present.has(key)) ?? null
    );
  }

  // ── Public render payload (§14) ────────────────────────────────────────────────

  async render(slug: string, query: HubRenderQueryDto) {
    const locale = query.locale ?? Locale.en;

    const hub = await this.prisma.hub.findFirst({
      where: {
        slug,
        destinationId: query.destinationId,
        isActive: true,
        status: HubStatus.PUBLISHED,
      },
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        hubType: true,
        heroImage: true,
        ogImage: true,
        destinationId: true,
        translations: {
          where: { locale },
          select: {
            name: true,
            h1Override: true,
            heroTagline: true,
            overview: true,
            breadcrumbLabel: true,
          },
        },
        allowedCategories: {
          select: { category: { select: { slug: true } } },
        },
      },
    });

    if (!hub) {
      throw new NotFoundException(`Hub "${slug}" not found`);
    }

    // English fallback for editorial lead / h1 / tagline when the locale row is empty.
    const localeT = hub.translations[0];
    const enT =
      locale === Locale.en
        ? localeT
        : await this.prisma.hubTranslation.findUnique({
            where: { hubId_locale: { hubId: hub.id, locale: Locale.en } },
            select: {
              name: true,
              h1Override: true,
              heroTagline: true,
              overview: true,
              breadcrumbLabel: true,
            },
          });

    const h1 =
      localeT?.h1Override ??
      enT?.h1Override ??
      localeT?.name ??
      enT?.name ??
      hub.name;
    const heroTagline = localeT?.heroTagline ?? enT?.heroTagline ?? null;
    const editorialLead = localeT?.overview ?? enT?.overview ?? null;
    const breadcrumbLabel =
      localeT?.breadcrumbLabel ?? enT?.breadcrumbLabel ?? null;

    const [
      sectionRows,
      ourPicks,
      comparison,
      faqRows,
      relatedHubs,
      heroStats,
      pageContentRows,
    ] = await Promise.all([
      // Sections and FAQs are fetched for the locale *and* English, then
      // resolved down in memory - see `resolveLocaleSet` / `resolveFaqLocale`.
      this.prisma.hubContentSection.findMany({
        where: { hubId: hub.id, locale: { in: [locale, Locale.en] } },
        select: this.contentSectionSelect,
        orderBy: [{ sectionType: 'asc' }, { displayOrder: 'asc' }],
      }),
      this.getOurPicks(hub.id, locale, query.currency),
      this.getComparison(hub.id, locale, query.currency),
      this.prisma.faq.findMany({
        where: {
          pageType: FAQ_PAGE_TYPE.HUB,
          entityId: hub.id,
          isActive: true,
          locale: { in: [locale, Locale.en] },
        },
        select: faqSelect,
        orderBy: { displayOrder: 'asc' },
      }),
      this.prisma.hub.findMany({
        where: {
          destinationId: hub.destinationId,
          isActive: true,
          status: HubStatus.PUBLISHED,
          id: { not: hub.id },
        },
        select: { id: true, slug: true, name: true, heroImage: true },
        orderBy: { name: 'asc' },
        take: 3,
      }),
      this.computeHeroStats(hub.id),
      this.prisma.hubPageContent.findMany({
        where: { hubId: hub.id, locale: { in: [locale, Locale.en] } },
        select: {
          locale: true,
          aboutText: true,
          metaTitle: true,
          metaDescription: true,
        },
      }),
    ]);

    const faqs = resolveFaqLocale(faqRows, locale);

    // Blocks fall back per BLOCK and per FIELD, keyed on the same
    // (sectionType, displayOrder) pair the editor and the Translation Console
    // address them by. Previously this was set-level (`resolveLocaleSet`), so
    // translating one Discover block hid every untranslated sibling instead of
    // showing it in English - and a heading cleared in the console rendered as
    // a blank line rather than the English heading.
    const sectionsOfType = (type: HubSectionType) =>
      resolveBlocksByPosition(
        sectionRows.filter((s) => s.sectionType === type),
        locale,
      );

    const fastFacts = sectionsOfType(HubSectionType.FAST_FACT);
    const discover = sectionsOfType(HubSectionType.DISCOVER);
    const localTips = sectionsOfType(HubSectionType.LOCAL_TIP);
    // The Discover block's intro/subtitle is authored as an EDITORIAL content
    // section (dashboard-managed + per-locale); the frontend falls back to a
    // static string when a hub has none.
    const discoverIntro =
      sectionsOfType(HubSectionType.EDITORIAL)[0]?.body ?? null;
    // First-timer "tick" takeaways (green-check row) - HIGHLIGHT sections, each
    // body a single takeaway, ordered by displayOrder.
    const highlights = sectionsOfType(HubSectionType.HIGHLIGHT).map(
      (s) => s.body,
    );

    // Authored SEO + About copy, locale first then English. Folded into the
    // render payload so the page is one request, not two.
    const localePc = pageContentRows.find((p) => p.locale === locale);
    const enPc = pageContentRows.find((p) => p.locale === Locale.en);
    const pageContent = {
      aboutText: localePc?.aboutText ?? enPc?.aboutText ?? null,
      metaTitle: localePc?.metaTitle ?? enPc?.metaTitle ?? null,
      metaDescription:
        localePc?.metaDescription ?? enPc?.metaDescription ?? null,
    };

    return {
      id: hub.id,
      slug: hub.slug,
      name: localeT?.name ?? enT?.name ?? hub.name,
      locale,
      hubType: hub.hubType,
      breadcrumbLabel,
      description: hub.description,
      ogImage: hub.ogImage,
      pageContent,
      hero: {
        heroImage: hub.heroImage,
        h1,
        heroTagline,
        fastFacts,
        // At-a-glance pills computed from the LIVE tour set (not editorial).
        stats: heroStats,
      },
      editorialLead,
      ourPicks: ourPicks.ourPicks,
      comparisonGroups: comparison.groups,
      discoverIntro,
      highlights,
      discover,
      localTips,
      faqs,
      relatedHubs,
      // Category slugs this hub is scoped to; the frontend "Also worth your
      // time" grid excludes these so it never surfaces a category the hub
      // already covers.
      allowedCategorySlugs: hub.allowedCategories.map((a) => a.category.slug),
    };
  }

  // ── FAQ ───────────────────────────────────────────────────────────────────────

  /**
   * Public FAQ read. With a locale it fetches that locale AND English and
   * resolves per group and per field: an untranslated FAQ shows in English
   * rather than vanishing, and a field cleared in the Translation Console
   * falls back on its own (English question next to a translated answer).
   * Without a locale it returns every row - the admin listing.
   */
  async getFaqs(id: string, query: FaqLocaleQueryDto) {
    await this.findHubOrThrow(id);

    const rows = await this.prisma.faq.findMany({
      where: {
        pageType: FAQ_PAGE_TYPE.HUB,
        entityId: id,
        isActive: true,
        ...(query.locale && { locale: { in: [query.locale, Locale.en] } }),
      },
      select: faqSelect,
      orderBy: [{ locale: 'asc' }, { displayOrder: 'asc' }],
    });

    return query.locale ? resolveFaqLocale(rows, query.locale) : rows;
  }

  async createFaq(id: string, dto: CreateHubFaqDto, adminId: string) {
    await this.findHubOrThrow(id);

    const faq = await this.prisma.faq.create({
      data: {
        pageType: FAQ_PAGE_TYPE.HUB,
        entityId: id,
        locale: dto.locale,
        question: dto.question,
        answer: dto.answer,
        displayOrder: dto.displayOrder ?? 0,
      },
      select: faqSelect,
    });

    this.logger.log(
      `Admin ${adminId} created FAQ for hub ${id} [${dto.locale}]`,
    );
    return faq;
  }

  async updateFaq(
    id: string,
    faqId: string,
    dto: UpdateHubFaqDto,
    adminId: string,
  ) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.HUB, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(`FAQ ${faqId} not found for hub ${id}`);

    const updated = await this.prisma.faq.update({
      where: { id: faqId },
      data: {
        ...(dto.question !== undefined && { question: dto.question }),
        ...(dto.answer !== undefined && { answer: dto.answer }),
        ...(dto.displayOrder !== undefined && {
          displayOrder: dto.displayOrder,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      select: faqSelect,
    });

    this.logger.log(`Admin ${adminId} updated FAQ ${faqId} for hub ${id}`);
    return updated;
  }

  async deleteFaq(id: string, faqId: string, adminId: string) {
    const faq = await this.prisma.faq.findFirst({
      where: { id: faqId, pageType: FAQ_PAGE_TYPE.HUB, entityId: id },
    });
    if (!faq)
      throw new NotFoundException(`FAQ ${faqId} not found for hub ${id}`);

    await this.prisma.faq.delete({ where: { id: faqId } });

    this.logger.log(`Admin ${adminId} deleted FAQ ${faqId} for hub ${id}`);
    return { message: 'FAQ deleted successfully' };
  }

  // ── Grouped FAQ (add in English, then translate) ────────────────────────────
  // Thin wrappers over the shared FaqGroupService; each verifies the hub exists
  // first so 404s are accurate, then delegates the grouped-FAQ logic.

  async getFaqGroups(id: string) {
    await this.findHubOrThrow(id);
    return this.faqGroups.getGroups(FAQ_PAGE_TYPE.HUB, id);
  }

  async createFaqGroup(id: string, dto: CreateFaqGroupDto, adminId: string) {
    await this.findHubOrThrow(id);
    this.logger.log(`Admin ${adminId} created FAQ for hub ${id}`);
    return this.faqGroups.createGroup(FAQ_PAGE_TYPE.HUB, id, dto);
  }

  async upsertFaqTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    dto: UpsertFaqTranslationDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);
    this.logger.log(
      `Admin ${adminId} upserted FAQ ${groupId} [${locale}] for hub ${id}`,
    );
    return this.faqGroups.upsertTranslation(
      FAQ_PAGE_TYPE.HUB,
      id,
      groupId,
      locale,
      dto,
    );
  }

  async updateFaqGroup(
    id: string,
    groupId: string,
    dto: UpdateFaqGroupDto,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);
    this.logger.log(`Admin ${adminId} updated FAQ ${groupId} for hub ${id}`);
    return this.faqGroups.updateGroup(FAQ_PAGE_TYPE.HUB, id, groupId, dto);
  }

  /** Clear ONE locale of a FAQ (Translation Console) - see FaqGroupService. */
  async deleteFaqTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    adminId: string,
  ) {
    await this.findHubOrThrow(id);
    this.logger.log(
      `Admin ${adminId} cleared FAQ ${groupId} [${locale}] for hub ${id}`,
    );
    return this.faqGroups.deleteTranslation(
      FAQ_PAGE_TYPE.HUB,
      id,
      groupId,
      locale,
    );
  }

  async deleteFaqGroup(id: string, groupId: string, adminId: string) {
    await this.findHubOrThrow(id);
    this.logger.log(`Admin ${adminId} deleted FAQ ${groupId} for hub ${id}`);
    return this.faqGroups.deleteGroup(FAQ_PAGE_TYPE.HUB, id, groupId);
  }
}
