import { Locale } from '@/common/constants/locales';
import {
  clearCooledDownSlugs,
  isSlugTaken,
  markSlugsDeleted,
  renameEntitySlug,
  slugRowBlocks,
} from '@/common/utils/slug-registry.util';
import { generateSlug } from '@/common/utils/slug.util';
import { mergeTranslation } from '@/common/utils/translation.util';
import { dateKey } from '@/common/utils/timezone.util';
import {
  isPlatformWideRole,
  resolveOperatorId,
} from '@/common/utils/operator.util';
import { isValidIanaTimeZone } from '@/common/validators/is-iana-timezone.validator';
import { CATEGORY_PAGE_MIN_TOURS } from '@/common/constants/category-visibility';
import { PrismaService } from '@/prisma/prisma.service';
import { AvailabilityService } from '@/availability/availability.service';
import { isDepartureLiveBookable } from '@/availability/availability-status.util';
import {
  DERIVED_ATTRIBUTE_KEYS,
  deriveTourAttributes,
  derivedAttributeTourSelect,
  buildDerivedAttributeWhere,
} from '@/attributes/derived-attributes';
import { PAID_TIER_MAX_RANK } from '@/tiers/tiers.service';
import { cardTeaser, cardTeaserTranslationSelect } from './card-teaser';
import { isOvernightCharter } from './overnight';
import { evaluateLikelyToSellOut } from './demand-signal';
import { computeQualityScore, listingCompleteness } from './quality-score';
import {
  applyMostPopularCap,
  deriveTourBadge,
  type BadgeInput,
  type TourBadge,
} from './tour-badge';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BandParticipation,
  CollectionStatus,
  Currency,
  DepartureStatus,
  HubStatus,
  InboxEvent,
  PickupModel,
  PricingModel,
  Prisma,
  Role,
  SlugEntityType,
  TourApprovalStatus,
  TourStatus,
  WholeUnitType,
} from '@prisma/client';
import { FxRatesService } from '@/fx/fx-rates.service';
import { InboxService } from '@/inbox/inbox.service';
import { EmailSettingsService } from '@/mail/email-settings.service';
import { MailService } from '@/mail/mail.service';
import { dashboardAppBase } from '@/common/utils/app-urls.util';
import {
  AdminToursQueryDto,
  CreateTourDto,
  MyToursQueryDto,
  TourAlternativesQueryDto,
  SearchSort,
  TourBySlugQueryDto,
  TourQueryDto,
  TourSort,
  UpdateTourDto,
} from './dto/tour.dto';

/**
 * Mirrors `@default(10)` on `tours.maxPartySize`. Only used to reason about a
 * create body that omitted the field - Prisma writes the real default; this is
 * what the range guard compares against so it cannot disagree with the row.
 */
const DEFAULT_MAX_PARTY_SIZE = 10;

/**
 * Statuses an operator may ASK Island Tours to look at - and therefore the
 * statuses an admin may approve or reject a request from.
 *
 * Conflict #1 says going live is always ours: `publish`, `unpause` and
 * `restore` are MANAGE_TRIPS and stay that way. But the matching half of that
 * rule is that the operator must be able to ASK, and `submit-for-review` used
 * to accept DRAFT only. That left PAUSED and ARCHIVED as dead ends: every exit
 * from them is MANAGE_TRIPS, so an operator whose tour was paused had exactly
 * one action available (archive it, i.e. further down) and one whose tour was
 * archived had none at all. Reported 2026-08-01 (operator pass §02).
 *
 * Submitting does NOT move `status` - it only stamps `approvalStatus =
 * PENDING` and queues the request. The upward move is still an admin's, so
 * this widens who can knock on the door, never who may open it.
 *
 * LIVE is excluded on purpose: a live tour is already published, and asking to
 * review it is not a thing - pause or archive it first.
 */
const REVIEWABLE_STATUSES: readonly TourStatus[] = [
  TourStatus.DRAFT,
  TourStatus.PAUSED,
  TourStatus.ARCHIVED,
];

@Injectable()
export class ToursService {
  private readonly logger = new Logger(ToursService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly fx: FxRatesService,
    private readonly mail: MailService,
    private readonly emailSettings: EmailSettingsService,
    private readonly inbox: InboxService,
  ) {}

  /**
   * Attach the converted-price `money` object (guide §20.9) to a page of flattened tour
   * cards, in place. Resolves each DISTINCT source currency's display rate once (≤2 DB
   * reads per page), then converts each card synchronously. When no `target` is given (or
   * a rate is unavailable) the card shows its own source currency at rate 1 - a display
   * fallback that never blocks the page. Uses the raw Decimal `priceFrom`/`basePrice`.
   */
  /** Attach the display `money` object to each card (guide §20.9). Delegates to the
   *  single reusable implementation in {@link FxRatesService.attachMoney}; the tour
   *  shape holds its source currency in `defaultCurrency`. */
  private async attachMoney(
    items: Array<{
      defaultCurrency: Currency;
      priceFrom?: Prisma.Decimal | null;
      basePrice?: Prisma.Decimal | null;
      money?: unknown;
    }>,
    target?: Currency,
  ): Promise<void> {
    await this.fx.attachMoney(items, target, 'defaultCurrency');
  }

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
    unitIncludedGuests: true,
    extraPersonPrice: true,
    durationMinutesFrom: true,
    durationMinutesTo: true,
    sleepAboard: true,
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
    onArrivalPayment: true,
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
    approvalStatus: true,
    submittedAt: true,
    reviewNote: true,
    publishedAt: true,
    createdAt: true,
    updatedAt: true,
    // V2 §4 many-to-many - flattened by flattenTour() into categoryIds/primaryCategoryId/hubIds.
    categories: { select: { categoryId: true, isPrimary: true } },
    // The hub's name/slug ride along so a card can show its hub eyebrow
    // (master 3.5 "Title and hub context"). Base name rather than the locale
    // translation: hub names are proper nouns (Klein Curacao, Willemstad) and
    // `tourSelect` is a static shape shared by every listing query, so a
    // locale-scoped join here would mean threading a locale through all of them.
    hubs: {
      select: { hubId: true, hub: { select: { name: true, slug: true } } },
    },
  } as const;

  /**
   * Flattens the TourCategory/TourHub relation arrays into the response-friendly
   * `categoryIds` / `primaryCategoryId` / `hubIds` shape.
   */
  private flattenTour<
    T extends {
      categories?: { categoryId: string; isPrimary: boolean }[];
      hubs?: { hubId: string; hub?: { name: string; slug: string } | null }[];
      // Required (every caller selects via `tourSelect`): a narrowed select
      // missing either would silently misclassify - keep the compile guard.
      sleepAboard: boolean;
      durationMinutesFrom: number | null;
    },
  >(tour: T) {
    const { categories, hubs, ...rest } = tour;
    return {
      ...rest,
      // Backend-computed Day/Overnight charter verdict (overnight.ts). Served
      // so the frontend partitions on it instead of mirroring the rule.
      isOvernight: isOvernightCharter(tour),
      categoryIds: categories?.map((c) => c.categoryId) ?? [],
      primaryCategoryId:
        categories?.find((c) => c.isPrimary)?.categoryId ?? null,
      hubIds: hubs?.map((h) => h.hubId) ?? [],
      /*
       * The hubs a card can name. `hubIds` alone cannot be rendered - the card
       * needs the label - and resolving ids to names on the frontend would mean
       * a second request per listing.
       */
      hubs:
        hubs?.flatMap((h) =>
          h.hub ? [{ id: h.hubId, name: h.hub.name, slug: h.hub.slug }] : [],
        ) ?? [],
    };
  }

  /**
   * Batch-loads each tour's attribute values for listing cards, keyed by tour id.
   * One query across all card tour ids + one for the active definitions (so the
   * card only ever surfaces live attributes), then grouped in memory. Returns
   * `{ key, value, dataType }[]` per tour (raw stored value; ENUM_MULTI stays a
   * JSON-encoded array string) so the frontend can compose the chip row itself.
   */
  private async loadCardAttributes(
    tourIds: string[],
  ): Promise<Map<string, { key: string; value: string; dataType: string }[]>> {
    const result = new Map<
      string,
      { key: string; value: string; dataType: string }[]
    >();
    if (tourIds.length === 0) return result;

    const [rows, defs, toursForDerive] = await Promise.all([
      this.prisma.tourAttribute.findMany({
        where: { tourId: { in: tourIds } },
        select: { tourId: true, attributeKey: true, attributeValue: true },
      }),
      this.prisma.attributeDefinition.findMany({
        where: { isActive: true },
        select: { key: true, dataType: true },
      }),
      this.prisma.tour.findMany({
        where: { id: { in: tourIds } },
        select: { id: true, ...derivedAttributeTourSelect },
      }),
    ]);
    const dataTypeByKey = new Map(defs.map((d) => [d.key, d.dataType]));

    // Stored chips, minus derived keys (those are computed from the tour's fields
    // below - the Details are the single source of truth).
    for (const r of rows) {
      if (DERIVED_ATTRIBUTE_KEYS.has(r.attributeKey)) continue;
      const dataType = dataTypeByKey.get(r.attributeKey);
      if (!dataType) continue; // definition inactive/removed - skip
      const list = result.get(r.tourId) ?? [];
      list.push({ key: r.attributeKey, value: r.attributeValue, dataType });
      result.set(r.tourId, list);
    }

    // Derived chips computed from first-class fields.
    for (const t of toursForDerive) {
      const list = result.get(t.id) ?? [];
      for (const d of deriveTourAttributes(t)) {
        const dataType = dataTypeByKey.get(d.key);
        if (!dataType) continue; // definition inactive/removed - skip
        list.push({ key: d.key, value: d.value, dataType });
      }
      if (list.length) result.set(t.id, list);
    }
    return result;
  }

  /**
   * Listing badge for a tour card (master §3.6 "Badges" + §3.7 "Demand
   * signaling"). A card shows AT MOST ONE badge in its top-left slot; this
   * resolves overlaps by priority and returns the frontend `TourBadge` key
   * directly (no translation layer needed). Full write-up:
   * `technical-doc/03-implementation/TOUR-BADGES.md`.
   *
   * Priority (first match wins) - PRODUCT DECISION 2026-07-18 (final): earned
   * badges lead; 'sponsored' is the FALLBACK label for any paid placement with
   * nothing better to show, so a top-ranked card always explains why it is up
   * there ("transparency is a brand pillar"):
   *
   *   1. 'likelyToSellOut'  Demand signal (§3.7), evaluated daily: tour_age >= 90d
   *                         AND >= 3 sellouts in the last 60d AND < 40% availability
   *                         over the next 30d. Computed by `evaluateLikelyToSellOut`
   *                         (src/tours/demand-signal.ts) into `tour.likelyToSellOut`;
   *                         the manual CMS launch override (`likelyToSellOutOverride`)
   *                         wins when set. Read here as `override ?? computed`. The
   *                         most selective badge (~5-10% of catalog).
   *   2. 'mostPopular'      Organic social proof: review_count >= 10 AND rating
   *                         >= 4.5. Never granted on commission grounds. The
   *                         "max 1 per category" cap is listing-level
   *                         (`applyMostPopularCap`); this returns per-tour
   *                         eligibility only.
   *   3. 'new'              Freshness: published < 30 days ago AND review_count == 0.
   *                         On the card it replaces the rating row.
   *   4. 'sponsored'        Paid placement with no earned badge: an ACTIVE
   *                         Destination Spotlight (`isSponsored`) OR a paid tier
   *                         P1-P3 (`tier_rank <= 3`, master §3.6 "Paid tiers P1
   *                         to P3 placements"). Labels why an unrated card sits
   *                         at the top; an earned badge is always more valuable
   *                         and replaces it.
   *
   * 1 and 3 are mutually exclusive (age >= 90 vs < 30); 2 and 3 are mutually
   * exclusive (>= 10 reviews vs 0). RANKING is untouched by any of this:
   * `is_sponsored DESC, tier_rank ASC, quality_score DESC, id ASC`.
   */
  private deriveTourBadge(tour: BadgeInput, now: Date = new Date()): TourBadge {
    return deriveTourBadge(tour, now);
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

  /**
   * Card image set for public listing feeds: hero first, then gallery order,
   * capped so list payloads stay lean. Powers the card hover-carousel (the
   * frontend shows arrows/dots only when a card has more than one image).
   */
  private readonly cardImagesArgs = {
    select: this.heroImageSelect,
    // Not `as const`: Prisma's orderBy input types are mutable arrays.
    orderBy: [{ isHero: 'desc' as const }, { displayOrder: 'asc' as const }],
    take: 5 as const,
  };

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
    // Shared util: owner account, ACTIVE team seat, or admin auto-provision.
    return resolveOperatorId(this.prisma, userId, role);
  }

  /**
   * The review workflow is operator/platform-internal. Every PUBLIC payload
   * (browse grid, slug detail, non-privileged id reads) gets the fields
   * neutralized - a LIVE tour is by definition approved, and the admin's
   * review note must never reach travelers.
   */
  private neutralizeApprovalFields(t: {
    approvalStatus?: unknown;
    submittedAt?: unknown;
    reviewNote?: unknown;
  }): void {
    t.approvalStatus = TourApprovalStatus.APPROVED;
    t.submittedAt = null;
    t.reviewNote = null;
  }

  /**
   * The operator's private commercial terms and our internal ranking state.
   *
   * The tier drives placement (COMMERCIAL-MODEL), but the RATE an operator
   * agreed to pay is their own business, and `qualityScore` / `eligibilityState`
   * / `grace*` are platform internals. Left in a public payload they let anyone
   * scrape every operator's exact commission and see who is on probation.
   *
   * ## Why this strips on OUTPUT instead of narrowing `tourSelect`
   *
   * `tierRank` is load-bearing server-side: BOTH `deriveTourBadge` and
   * `applyMostPopularCap` decide the Sponsored badge from
   * `isSponsored || tierRank <= PAID_TIER_MAX_RANK`. Dropping it from the select
   * would silently kill the badge and the per-category cap. So it must be
   * selected, used, and only then removed - call this LAST, after badge
   * derivation and after `applyMostPopularCap`.
   *
   * ## What deliberately stays
   *
   * - `isSponsored` - a boolean, not a rate; the public site renders it
   *   (`lib/tours/booking.ts` sponsored notice, wishlist cards).
   * - `operatorId` - a join key the public site uses for its `operator:<id>`
   *   cache tag, and the operator's name/logo are already public on the page.
   *
   * Fields are nulled rather than deleted so the documented response contract
   * (`TourResponseDto`) stays structurally valid for every consumer.
   */
  private neutralizeCommercialFields(t: {
    commissionTier?: unknown;
    tierKey?: unknown;
    tierRank?: unknown;
    tierLockedUntil?: unknown;
    qualityScore?: unknown;
    eligibilityState?: unknown;
    graceStartedAt?: unknown;
    graceMetric?: unknown;
  }): void {
    t.commissionTier = null;
    t.tierKey = null;
    t.tierRank = null;
    t.tierLockedUntil = null;
    t.qualityScore = null;
    t.eligibilityState = null;
    t.graceStartedAt = null;
    t.graceMetric = null;
  }

  /**
   * Everything a traveler-facing payload must have stripped: the review
   * workflow AND the commercial/ranking internals.
   *
   * Use this at every `@Public()` read exit (browse grid, search, typeahead,
   * slug detail, wishlist resolve). `findOne` is the one shared route - the
   * dashboard reads it too - so it applies this only to non-staff, non-owner
   * callers.
   */
  private neutralizeForPublic(t: {
    approvalStatus?: unknown;
    submittedAt?: unknown;
    reviewNote?: unknown;
    commissionTier?: unknown;
    tierKey?: unknown;
    tierRank?: unknown;
    tierLockedUntil?: unknown;
    qualityScore?: unknown;
    eligibilityState?: unknown;
    graceStartedAt?: unknown;
    graceMetric?: unknown;
  }): void {
    this.neutralizeApprovalFields(t);
    this.neutralizeCommercialFields(t);
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
   * the DEFAULT age-band price (the adult reference price - never a cheaper
   * child/senior band), or `basePrice` when there are no age bands.
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
      select: { basePrice: true, pricingModel: true },
    });
    if (!tour) return null;

    // UNIT (whole-unit / charter): priceFrom is always the whole-unit base price
    // (age bands do not apply). PER_PERSON: anchor off the DEFAULT participant
    // TourAgeBand (founder rule: the anchor is the adult/default price, not the
    // cheapest child band), falling back to the cheapest participant band when
    // no band is flagged default, then basePrice when no bands exist.
    let priceFrom: Prisma.Decimal | null;
    if (tour.pricingModel === PricingModel.UNIT) {
      priceFrom = tour.basePrice ?? null;
    } else {
      const anchorBand = await client.tourAgeBand.findFirst({
        where: { tourId, participation: BandParticipation.PARTICIPANT },
        orderBy: [{ isDefault: 'desc' }, { price: 'asc' }],
        select: { price: true },
      });
      priceFrom = anchorBand?.price ?? tour.basePrice ?? null;
    }

    await client.tour.update({ where: { id: tourId }, data: { priceFrom } });
    return priceFrom;
  }

  /**
   * Resolves an ordered list of tour ids to flattened LIVE tours, preserving the input
   * order and dropping any that are missing/not live. Used by manual Collections.
   */
  async findPublicByIds(ids: string[], target?: Currency, locale?: Locale) {
    if (!ids.length) return [];
    const tours = await this.prisma.tour.findMany({
      // Bookability gate (master §7.2): excluded from EVERY ranked result set -
      // curated collection lists included.
      where: {
        id: { in: ids },
        status: TourStatus.LIVE,
        isActive: true,
        isBookable: true,
      },
      select: {
        ...this.tourSelect,
        images: this.cardImagesArgs,
        // Card teaser for the carousel description slide (S4j). English when
        // the caller is not locale-aware (legacy resolution paths).
        translations: {
          where: { locale: locale ?? Locale.en },
          select: cardTeaserTranslationSelect,
        },
      },
    });
    const byId = new Map(
      tours.map(({ translations, ...t }) => [
        t.id,
        {
          ...this.flattenTour(t),
          shortDescription: cardTeaser(translations[0]),
        },
      ]),
    );
    const result = ids
      .map((id) => byId.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
    await this.attachMoney(result, target);
    // Wishlist resolve is @Public() - strip the review workflow and the
    // commercial internals before this leaves the server.
    result.forEach((t) => this.neutralizeForPublic(t));
    return result;
  }

  /**
   * All-sold-out recovery (AVAILABILITY-AND-DEPARTURES.md §8): the 2-3 tours the
   * booking widget offers instead of a blank calendar when the tour the traveler
   * is looking at has no open departure in the next 30 days.
   *
   * The spec's shape - "2-3 same-category tours that have an open departure within
   * 7 days" - is met by walking three progressively wider candidate rings, always
   * inside the SAME destination (an alternative on another island is not an
   * alternative to someone already booking flights):
   *
   *   1. the source tour's PRIMARY category  ← "same-category" in the strict sense
   *   2. its other categories                ← still same-category, just not primary
   *   3. anything else in the destination    ← last resort, so the dead end is
   *                                            never a blank block
   *
   * Each ring is fetched in the canonical ranking order and filtered down to tours
   * with a live-bookable departure inside the 7-day window; the walk stops as soon
   * as {@link ALTERNATIVES_MAX} are found, so ring 2/3 usually cost nothing. Which
   * ring a card came from is deliberately NOT exposed - the traveler sees three
   * tours that have room, not a relevance ladder.
   *
   * Returns `[]` (never throws) when the destination has nothing bookable this
   * week; the widget then falls back to its plain "no availability" state.
   */
  async findDeadEndAlternatives(
    tourId: string,
    query: TourAlternativesQueryDto,
  ) {
    const { locale = Locale.en, currency } = query;

    // The source tour is deliberately NOT gated on isBookable / LIVE: a tour in
    // the dead end is by definition the one whose availability ran out, and its
    // detail page is still reachable (findBySlug gates on LIVE + isActive only).
    const source = await this.prisma.tour.findUnique({
      where: { id: tourId },
      select: {
        id: true,
        destinationId: true,
        categories: { select: { categoryId: true, isPrimary: true } },
      },
    });
    if (!source) throw new NotFoundException(`Tour ${tourId} not found`);

    const primaryCategoryId =
      source.categories.find((c) => c.isPrimary)?.categoryId ??
      source.categories[0]?.categoryId ??
      null;
    const otherCategoryIds = source.categories
      .map((c) => c.categoryId)
      .filter((id) => id !== primaryCategoryId);

    // Same bookability gate as every other ranked result set (master §7.2) - an
    // alternative that is itself excluded from listings is not an alternative.
    const baseWhere: Prisma.TourWhereInput = {
      destinationId: source.destinationId,
      status: TourStatus.LIVE,
      isActive: true,
      isBookable: true,
    };

    const rings: Prisma.TourWhereInput[] = [];
    if (primaryCategoryId)
      rings.push({ categories: { some: { categoryId: primaryCategoryId } } });
    if (otherCategoryIds.length > 0)
      rings.push({
        categories: { some: { categoryId: { in: otherCategoryIds } } },
      });
    // The destination-wide ring always exists, so a tour with no categories at
    // all (data that should not happen, but does not deserve a blank block)
    // still recovers.
    rings.push({});

    const fromKey = dateKey(new Date());
    const toKey = dateKey(
      new Date(
        Date.now() + ToursService.ALTERNATIVES_HORIZON_DAYS * 86_400_000,
      ),
    );

    const picked: Awaited<ReturnType<ToursService['loadAlternativeCards']>> =
      [];
    const seen = new Set<string>([source.id]);

    for (const ring of rings) {
      if (picked.length >= ToursService.ALTERNATIVES_MAX) break;
      const candidates = await this.prisma.tour.findMany({
        where: { ...baseWhere, ...ring, id: { notIn: [...seen] } },
        select: { id: true },
        orderBy: this.buildOrderBy(TourSort.recommended),
        // Over-fetch relative to MAX: most candidates will fail the 7-day
        // window, and a ring that yields nothing must not silently truncate a
        // tour that WAS available just below the cut.
        take: ToursService.ALTERNATIVES_CANDIDATE_POOL,
      });
      if (candidates.length === 0) continue;
      candidates.forEach((c) => seen.add(c.id));

      const nextDates = await this.availability.nextBookableDateByTour(
        candidates.map((c) => c.id),
        fromKey,
        toKey,
      );
      // `candidates` is already in canonical rank order; keep it.
      const withRoom = candidates
        .filter((c) => nextDates.has(c.id))
        .slice(0, ToursService.ALTERNATIVES_MAX - picked.length);
      if (withRoom.length === 0) continue;

      picked.push(
        ...(await this.loadAlternativeCards(
          withRoom.map((c) => c.id),
          nextDates,
          locale,
        )),
      );
    }

    // §3.6 "max 1 per category" cap on the Most popular badge, same as search().
    this.applyMostPopularCap(picked);
    await this.attachMoney(picked, currency);
    // Cards leave through a @Public() route - strip the review workflow and the
    // commercial internals, exactly as every other public read does. Last, after
    // the badge + cap have consumed `tierRank`.
    picked.forEach((t) => this.neutralizeForPublic(t));
    return picked;
  }

  /**
   * How deep "Most relevant" ranks. The score is not a column, so relevance
   * ordering happens in app code over this many canonically-ranked candidates.
   * Past it (a term matching more than 500 LIVE tours, which no real query on a
   * per-island catalogue does) the results stay in canonical rank order rather
   * than paying for an unbounded id scan.
   */
  private static readonly RELEVANCE_POOL = 500;

  /** Dead-end alternatives must have room "within 7 days" (§8). */
  private static readonly ALTERNATIVES_HORIZON_DAYS = 7;
  /** "2-3 same-category tours" (§8) - three is the ceiling. */
  private static readonly ALTERNATIVES_MAX = 3;
  /** Per-ring candidates ranked before the 7-day availability filter. */
  private static readonly ALTERNATIVES_CANDIDATE_POOL = 24;

  /**
   * Hydrates ranked alternative ids into listing-card shape (the same `SearchHit`
   * the grids render), preserving the order of `ids`, and stamps each card with
   * the `nextAvailableDate` that earned it a place.
   */
  private async loadAlternativeCards(
    ids: string[],
    nextDates: Map<string, string>,
    locale: Locale,
  ) {
    const rows = await this.prisma.tour.findMany({
      where: { id: { in: ids } },
      select: {
        ...this.tourSelect,
        destination: { select: { slug: true } },
        translations: {
          where: { locale },
          select: { title: true, ...cardTeaserTranslationSelect },
        },
        images: this.cardImagesArgs,
      },
    });
    const byId = new Map(
      rows.map((t) => [
        t.id,
        {
          ...this.flattenSearchHit(t),
          badge: this.deriveTourBadge(t),
          /** `yyyy-MM-dd` of the departure that qualified this alternative. */
          nextAvailableDate: nextDates.get(t.id) ?? null,
        },
      ]),
    );
    return ids
      .map((id) => byId.get(id))
      .filter((t): t is NonNullable<typeof t> => Boolean(t));
  }

  /**
   * Full-text-ish search across tour name + translations (title/overview/description) +
   * category names + hub names + highlight text. Optionally scoped to a destination.
   * V1 uses case-insensitive `contains` (Postgres ILIKE); upgrade path: a `tsvector` GIN
   * column or Algolia/ElasticSearch for ranking + typo tolerance (V2 §10).
   */
  async search(params: {
    q?: string;
    destinationSlug?: string;
    /** Toolbar sort; `relevance` (the page default) ranks by match quality. */
    sort?: SearchSort;
    /** Category quick-filter chips: a tour in ANY of these matches. */
    categoryIds?: string[];
    date?: string;
    guests?: number;
    timeOfDay?: string[];
    minPrice?: number;
    maxPrice?: number;
    durationMin?: number;
    durationMax?: number;
    ratingMin?: number;
    cancellationMaxHours?: number;
    pickupAvailable?: boolean;
    locale?: Locale;
    currency?: Currency;
    page?: number;
    limit?: number;
  }) {
    const {
      destinationSlug,
      sort = SearchSort.relevance,
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
    // Optional date filter: keep only tours with a LIVE-bookable departure on
    // that calendar date - same cutoff/capacity rule as availability + listing
    // (not a coarse "has an OPEN row" check). Departure.date is a `@db.Date`.
    const parsedDate =
      params.date && !Number.isNaN(Date.parse(`${params.date}T00:00:00.000Z`))
        ? new Date(`${params.date}T00:00:00.000Z`)
        : null;
    const dateAvailableTourIds = parsedDate
      ? await this.findDateAvailableTourIds({
          date: parsedDate,
          guests: params.guests ?? 1,
          timeOfDay: params.timeOfDay ?? [],
        })
      : null;
    // Accent-insensitive text match, as ids + a relevance score (see
    // findTermMatchedTourScores). Both filters narrow by id, so they are ANDed
    // as separate clauses rather than fighting over one `id` key - a single
    // object cannot hold two.
    const scored = await this.findTermMatchedTourScores(term);
    const scoreById = new Map(scored.map((r) => [r.id, r.score]));
    const where: Prisma.TourWhereInput = {
      // Bookability gate (master §7.2): excluded from EVERY ranked result set -
      // search results included.
      status: TourStatus.LIVE,
      isActive: true,
      isBookable: true,
      ...(destinationSlug && { destination: { slug: destinationSlug } }),
      AND: [
        { id: { in: [...scoreById.keys()] } },
        ...(dateAvailableTourIds ? [{ id: { in: dateAvailableTourIds } }] : []),
      ],
    };
    // Category quick-filter chips (OR across the selection), same rule as the
    // listing endpoint's multi-select.
    if (params.categoryIds?.length)
      where.categories = { some: { categoryId: { in: params.categoryIds } } };
    // The toolbar's price / duration / rating / cancellation / pickup chips -
    // the same helper the listing endpoint uses, so one toolbar means one thing.
    this.applyToolbarFilters(where, params);

    const skip = (page - 1) * limit;
    const hitSelect = {
      ...this.tourSelect,
      // Each hit must carry enough to build its flat URL (/{dest}/{slug}) and
      // show a localized title + card teaser without a second round-trip.
      destination: { select: { slug: true } },
      translations: {
        where: { locale },
        select: { title: true, ...cardTeaserTranslationSelect },
      },
      images: this.cardImagesArgs,
      // Widened from tourSelect's id-only shape: the typeahead groups hits
      // under their (localized) primary-category name.
      categories: {
        select: {
          categoryId: true,
          isPrimary: true,
          category: {
            select: {
              slug: true,
              name: true,
              translations: {
                where: { locale },
                select: { name: true },
              },
            },
          },
        },
      },
    } as const;

    // `relevance` cannot be expressed as a Prisma `orderBy` (the score lives in
    // the raw match query, not on the row), so that sort ranks in app code over
    // a bounded candidate pool. Every other sort keeps the cheap skip/take path.
    const useRelevance =
      sort === SearchSort.relevance && skip < ToursService.RELEVANCE_POOL;

    const total = await this.prisma.tour.count({ where });
    let data: Prisma.TourGetPayload<{ select: typeof hitSelect }>[];
    if (useRelevance) {
      // Candidates arrive in canonical rank order, so a plain stable sort by
      // score keeps `is_sponsored, tier_rank, quality_score, id` as the
      // tie-break inside each relevance tier - no second ordering key needed.
      const candidates = await this.prisma.tour.findMany({
        where,
        select: { id: true },
        orderBy: this.buildOrderBy(TourSort.recommended),
        take: ToursService.RELEVANCE_POOL,
      });
      const pageIds = candidates
        .map((c, i) => ({ id: c.id, score: scoreById.get(c.id) ?? 0, i }))
        .sort((a, b) => b.score - a.score || a.i - b.i)
        .slice(skip, skip + limit)
        .map((c) => c.id);
      const rows = await this.prisma.tour.findMany({
        where: { id: { in: pageIds } },
        select: hitSelect,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      data = pageIds
        .map((id) => byId.get(id))
        .filter((r): r is NonNullable<typeof r> => Boolean(r));
    } else {
      data = await this.prisma.tour.findMany({
        where,
        select: hitSelect,
        orderBy: this.buildOrderBy(
          sort === SearchSort.price_asc
            ? TourSort.price_asc
            : sort === SearchSort.price_desc
              ? TourSort.price_desc
              : TourSort.recommended,
        ),
        skip,
        take: limit,
      });
    }
    const hits = data.map((t) => {
      const primary = t.categories.find((c) => c.isPrimary) ?? t.categories[0];
      const category = primary?.category;
      return {
        ...this.flattenSearchHit(t),
        badge: this.deriveTourBadge(t),
        categorySlug: category?.slug ?? null,
        categoryName:
          category?.translations?.[0]?.name?.trim() || category?.name || null,
      };
    });
    // §3.6 "max 1 per category" cap on the Most popular badge (display order).
    this.applyMostPopularCap(hits);
    await this.attachMoney(hits, params.currency);
    // Last, after the badge + cap have consumed `tierRank`.
    hits.forEach((t) => this.neutralizeForPublic(t));
    return {
      total,
      page,
      limit,
      query: term,
      data: hits,
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
      translations?: {
        title: string | null;
        shortDescription?: string | null;
        overview?: string | null;
      }[];
      categories?: { categoryId: string; isPrimary: boolean }[];
      hubs?: { hubId: string; hub?: { name: string; slug: string } | null }[];
      // Required by flattenTour's isOvernight computation (see its constraint).
      sleepAboard: boolean;
      durationMinutesFrom: number | null;
    },
  >(hit: T) {
    const { destination, translations, ...rest } = hit;
    return {
      ...this.flattenTour(rest),
      destinationSlug: destination?.slug ?? null,
      title: translations?.[0]?.title?.trim() || hit.name,
      // Null when the select did not ask for it (e.g. typeahead suggestions).
      shortDescription: cardTeaser(translations?.[0]),
    };
  }

  /**
   * Typeahead suggestions across entity types (Fever-style navbar dropdown):
   * matched categories (with a destination-scoped LIVE-tour count), matched
   * published hubs, tours inside the active destination, and a "beyond"
   * strip of tours from other destinations when the search is scoped.
   *
   * Same ILIKE matching rules as search(); intentionally small page sizes -
   * this feeds a dropdown, not a results page.
   */
  async suggest(params: {
    q?: string;
    destinationSlug?: string;
    locale?: Locale;
    currency?: Currency;
  }) {
    const { destinationSlug, locale = Locale.en } = params;
    const term = params.q?.trim();
    if (!term || term.length < 2) {
      return {
        query: term ?? '',
        total: 0,
        categories: [],
        hubs: [],
        collections: [],
        tours: [],
        beyondTours: [],
      };
    }

    // LIVE-and-active filter, scoped to the destination when one is set.
    const liveTourWhere: Prisma.TourWhereInput = {
      status: TourStatus.LIVE,
      isActive: true,
      ...(destinationSlug && { destination: { slug: destinationSlug } }),
    };

    /*
     * Same term surface as search() - name/translations/categories/hubs/
     * highlights - and the same accent-insensitive matcher, so the panel and
     * the results page can never disagree about what a word matches. Typing
     * "curacao" has to find "Curaçao" in BOTH or the dropdown says "no results"
     * for a query the results page would answer.
     */
    const [termMatchedTourIds, termMatchedEntities] = await Promise.all([
      this.findTermMatchedTourIds(term),
      this.findTermMatchedEntityIds(term, locale),
    ]);
    const termMatch: Prisma.TourWhereInput = {
      id: { in: termMatchedTourIds },
    };

    // Tour HITS additionally carry the §7.2 bookability gate (ranked result
    // set); category/hub suggestion gating stays on published-tour existence.
    const scopedWhere: Prisma.TourWhereInput = {
      ...liveTourWhere,
      ...termMatch,
      isBookable: true,
    };
    const beyondWhere: Prisma.TourWhereInput | null = destinationSlug
      ? {
          status: TourStatus.LIVE,
          isActive: true,
          isBookable: true,
          destination: { slug: { not: destinationSlug } },
          ...termMatch,
        }
      : null;

    const hitSelect = {
      ...this.tourSelect,
      destination: { select: { slug: true, name: true } },
      translations: { where: { locale }, select: { title: true } },
      images: this.cardImagesArgs,
      categories: {
        select: {
          categoryId: true,
          isPrimary: true,
          category: {
            select: {
              slug: true,
              name: true,
              translations: { where: { locale }, select: { name: true } },
            },
          },
        },
      },
    } as const;

    const [categories, hubs, collections, total, scopedTours, beyondTours] =
      await Promise.all([
        this.prisma.category.findMany({
          where: {
            isActive: true,
            id: { in: termMatchedEntities.categories },
            tourCategories: { some: { tour: liveTourWhere } },
          },
          select: {
            id: true,
            slug: true,
            name: true,
            heroImage: true,
            translations: { where: { locale }, select: { name: true } },
            _count: {
              select: { tourCategories: { where: { tour: liveTourWhere } } },
            },
          },
          orderBy: { sortOrder: 'asc' },
          // Over-fetch: the visibility bar is a COUNT, and Prisma cannot filter
          // on a relation count in `where`, so it is applied below. Taking 3
          // here would let three thin categories crowd out the ones that render.
          take: 12,
        }),
        this.prisma.hub.findMany({
          where: {
            isActive: true,
            status: HubStatus.PUBLISHED,
            ...(destinationSlug && { destination: { slug: destinationSlug } }),
            id: { in: termMatchedEntities.hubs },
            tourHubs: {
              some: { tour: { status: TourStatus.LIVE, isActive: true } },
            },
          },
          select: {
            id: true,
            slug: true,
            name: true,
            heroImage: true,
            translations: { where: { locale }, select: { name: true } },
            destination: { select: { slug: true, name: true } },
          },
          take: 3,
        }),
        // Collections were missing from the panel entirely, so an island's
        // flagship "Best Things to Do in X" page was unreachable by typing its
        // name. PUBLISHED + active is the collection page's own 404 condition.
        this.prisma.collection.findMany({
          where: {
            isActive: true,
            status: CollectionStatus.PUBLISHED,
            ...(destinationSlug && { destination: { slug: destinationSlug } }),
            id: { in: termMatchedEntities.collections },
          },
          select: {
            id: true,
            slug: true,
            name: true,
            heroImage: true,
            translations: { where: { locale }, select: { name: true } },
            destination: { select: { slug: true, name: true } },
          },
          orderBy: { sortOrder: 'asc' },
          take: 3,
        }),
        this.prisma.tour.count({ where: scopedWhere }),
        this.prisma.tour.findMany({
          where: scopedWhere,
          select: hitSelect,
          orderBy: this.buildOrderBy(TourSort.recommended),
          take: 4,
        }),
        beyondWhere
          ? this.prisma.tour.findMany({
              where: beyondWhere,
              select: hitSelect,
              orderBy: this.buildOrderBy(TourSort.recommended),
              take: 3,
            })
          : Promise.resolve(
              [] as Prisma.TourGetPayload<{ select: typeof hitSelect }>[],
            ),
      ]);

    const toHit = (t: (typeof scopedTours)[number]) => {
      const primary = t.categories.find((c) => c.isPrimary) ?? t.categories[0];
      const category = primary?.category;
      const destinationName = t.destination?.name ?? null;
      return {
        ...this.flattenSearchHit(t),
        badge: this.deriveTourBadge(t),
        destinationName,
        categorySlug: category?.slug ?? null,
        categoryName:
          category?.translations?.[0]?.name?.trim() || category?.name || null,
      };
    };

    const tours = scopedTours.map(toHit);
    const beyond = beyondTours.map(toHit);
    // §3.6 "max 1 per category" Most-popular cap, per rendered strip.
    this.applyMostPopularCap(tours);
    this.applyMostPopularCap(beyond);
    await this.attachMoney([...tours, ...beyond], params.currency);
    // Last, after the badge + cap have consumed `tierRank`.
    tours.forEach((t) => this.neutralizeForPublic(t));
    beyond.forEach((t) => this.neutralizeForPublic(t));

    return {
      query: term,
      total,
      /*
       * `image` is the target page's OWN hero photo, on every entity bucket.
       * The panel renders one row shape whether the visitor has typed or not,
       * so the typed state cannot fall back to generic glyphs while the zero
       * state shows photos - three identical grey squares tell a shopper
       * nothing about where each row leads. Null is fine and expected: the row
       * then draws the same flat surface every image container on the site
       * falls back to.
       */
      // Master §2.4: a category page only exists at >= CATEGORY_PAGE_MIN_TOURS,
      // so suggesting a thinner one offers a 404 as an autocomplete result.
      categories: categories
        .filter((c) => c._count.tourCategories >= CATEGORY_PAGE_MIN_TOURS)
        .slice(0, 3)
        .map((c) => ({
          id: c.id,
          slug: c.slug,
          name: c.translations[0]?.name?.trim() || c.name,
          image: c.heroImage,
          tourCount: c._count.tourCategories,
        })),
      hubs: hubs.map((h) => ({
        id: h.id,
        slug: h.slug,
        name: h.translations[0]?.name?.trim() || h.name,
        image: h.heroImage,
        destinationSlug: h.destination.slug,
        destinationName: h.destination.name,
      })),
      collections: collections.map((c) => ({
        id: c.id,
        slug: c.slug,
        name: c.translations[0]?.name?.trim() || c.name,
        image: c.heroImage,
        destinationSlug: c.destination.slug,
        destinationName: c.destination.name,
      })),
      tours,
      beyondTours: beyond,
    };
  }

  // ── Public list ───────────────────────────────────────────────────────────────

  // Known/typed query params - everything else in the raw query is treated as an attribute filter.
  private static readonly RESERVED_QUERY_KEYS = new Set([
    'search',
    'destinationId',
    'categoryId',
    'categoryIds',
    'hubId',
    'isLocalsFavourite',
    'pricingModel',
    'minPrice',
    'maxPrice',
    'durationMin',
    'durationMax',
    'ratingMin',
    'cancellationMaxHours',
    'pickupAvailable',
    'date',
    'guests',
    'timeOfDay',
    'locale',
    'page',
    'limit',
    'sort',
  ]);

  // Time-of-day buckets by departure start hour (UTC, from the `@db.Time` column).
  // Contiguous and gapless so every start time falls in exactly one bucket.
  private static readonly TIME_BUCKETS: Record<string, [number, number]> = {
    morning: [0, 12], // < 12:00
    afternoon: [12, 17], // 12:00-16:59
    evening: [17, 24], // >= 17:00
  };

  /**
   * Ids of the CATEGORIES, HUBS and COLLECTIONS whose name matches `term`
   * accent-insensitively, in the requested locale or its base name.
   *
   * The tour matcher's counterpart for the panel's entity rows. Without it,
   * "curacao" found the Curaçao tours (via `findTermMatchedTourIds`) but not
   * the "Klein Curaçao" hub sitting above them - one panel answering the same
   * word two different ways.
   *
   * One query rather than three: the buckets are read together, always.
   */
  private async findTermMatchedEntityIds(
    term: string,
    locale: Locale,
  ): Promise<{ categories: string[]; hubs: string[]; collections: string[] }> {
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const like = (col: Prisma.Sql) =>
      Prisma.sql`immutable_unaccent(${col}) ILIKE immutable_unaccent(${pattern}) ESCAPE '\\'`;

    const rows = await this.prisma.$queryRaw<{ kind: string; id: string }[]>(
      Prisma.sql`
        SELECT 'category' AS kind, c.id
        FROM categories c
        LEFT JOIN category_translations ct
          ON ct."categoryId" = c.id AND ct.locale = ${locale}::"Locale"
        WHERE ${like(Prisma.sql`c.name`)} OR ${like(Prisma.sql`ct.name`)}
        UNION ALL
        SELECT 'hub', h.id
        FROM hubs h
        LEFT JOIN hub_translations ht
          ON ht."hubId" = h.id AND ht.locale = ${locale}::"Locale"
        WHERE ${like(Prisma.sql`h.name`)} OR ${like(Prisma.sql`ht.name`)}
        UNION ALL
        SELECT 'collection', cl.id
        FROM collections cl
        LEFT JOIN collection_translations clt
          ON clt."collectionId" = cl.id AND clt.locale = ${locale}::"Locale"
        WHERE ${like(Prisma.sql`cl.name`)} OR ${like(Prisma.sql`clt.name`)}
      `,
    );

    const pick = (kind: string) => [
      ...new Set(rows.filter((r) => r.kind === kind).map((r) => r.id)),
    ];
    return {
      categories: pick('category'),
      hubs: pick('hub'),
      collections: pick('collection'),
    };
  }

  /**
   * The ids of tours whose searchable text matches `term`, ACCENT-INSENSITIVELY.
   *
   * `ILIKE` (Prisma's `mode: 'insensitive'`) folds case but not accents, so a
   * catalogue full of "Curaçao" returned nothing for "curacao" - the launch
   * island's own name, typed the way almost everyone types it. Only `cura`
   * worked, because it stops before the cedilla.
   *
   * Postgres has no accent-insensitive operator, so this is raw SQL over the
   * same five fields the Prisma filter covered - name, translations
   * (title/overview), category names, hub names, highlight text - with both
   * sides folded through `immutable_unaccent`. The result feeds back as
   * `id: { in: [...] }`, exactly the shape the date filter beside it already
   * uses, so the rest of the where-clause and the ranking are untouched.
   *
   * NOT scoped by destination or status here: the caller's own where-clause
   * still applies every gate, and keeping this to "does the text match" leaves
   * one job in one place.
   *
   * `%` and `_` in the term are escaped - "100%" must look for a literal
   * percent, not "anything".
   */
  private async findTermMatchedTourIds(term: string): Promise<string[]> {
    const rows = await this.findTermMatchedTourScores(term);
    return rows.map((r) => r.id);
  }

  /**
   * {@link findTermMatchedTourIds} plus a RELEVANCE score per tour - what the
   * search page's "Most relevant" sort orders by (Pastel #44).
   *
   * The score is where the term hit, not how often, because "how often" on an
   * ILIKE catalogue rewards long overviews rather than good matches:
   *
   *   100  the tour's own name/title IS the term
   *    80  its name/title STARTS WITH the term
   *    60  its name/title contains the term
   *    40  a category or hub name contains it  (a themed match, not this tour's)
   *    20  the overview or a highlight contains it (buried in body copy)
   *
   * `MAX` over the join fan-out, so a tour is scored by its BEST match and a
   * tour joined to five highlights is not thereby more relevant. Ties fall back
   * to the canonical ranking (`is_sponsored, tier_rank, quality_score, id`),
   * which is what the caller's candidate order already carries.
   */
  private async findTermMatchedTourScores(
    term: string,
  ): Promise<{ id: string; score: number }[]> {
    const escaped = term.replace(/[\\%_]/g, (c) => `\\${c}`);
    const pattern = `%${escaped}%`;
    const prefix = `${escaped}%`;
    const exact = escaped;
    const rows = await this.prisma.$queryRaw<{ id: string; score: number }[]>(
      Prisma.sql`
      SELECT t.id, MAX(
        CASE
          WHEN immutable_unaccent(t.name)     ILIKE immutable_unaccent(${exact})   ESCAPE '\\' THEN 100
          WHEN immutable_unaccent(tt.title)   ILIKE immutable_unaccent(${exact})   ESCAPE '\\' THEN 100
          WHEN immutable_unaccent(t.name)     ILIKE immutable_unaccent(${prefix})  ESCAPE '\\' THEN 80
          WHEN immutable_unaccent(tt.title)   ILIKE immutable_unaccent(${prefix})  ESCAPE '\\' THEN 80
          WHEN immutable_unaccent(t.name)     ILIKE immutable_unaccent(${pattern}) ESCAPE '\\' THEN 60
          WHEN immutable_unaccent(tt.title)   ILIKE immutable_unaccent(${pattern}) ESCAPE '\\' THEN 60
          WHEN immutable_unaccent(c.name)     ILIKE immutable_unaccent(${pattern}) ESCAPE '\\' THEN 40
          WHEN immutable_unaccent(h.name)     ILIKE immutable_unaccent(${pattern}) ESCAPE '\\' THEN 40
          WHEN immutable_unaccent(tt.overview) ILIKE immutable_unaccent(${pattern}) ESCAPE '\\' THEN 20
          WHEN immutable_unaccent(hlt.text)   ILIKE immutable_unaccent(${pattern}) ESCAPE '\\' THEN 20
          ELSE 0
        END
      )::int AS score
      FROM tours t
      LEFT JOIN tour_translations tt ON tt."tourId" = t.id
      LEFT JOIN tour_categories tc ON tc."tourId" = t.id
      LEFT JOIN categories c ON c.id = tc."categoryId"
      LEFT JOIN tour_hubs th ON th."tourId" = t.id
      LEFT JOIN hubs h ON h.id = th."hubId"
      LEFT JOIN tour_highlights hl ON hl."tourId" = t.id
      LEFT JOIN tour_highlight_translations hlt ON hlt."highlightId" = hl.id
      WHERE immutable_unaccent(t.name)   ILIKE immutable_unaccent(${pattern}) ESCAPE '\\'
         OR immutable_unaccent(tt.title) ILIKE immutable_unaccent(${pattern}) ESCAPE '\\'
         OR immutable_unaccent(tt.overview) ILIKE immutable_unaccent(${pattern}) ESCAPE '\\'
         OR immutable_unaccent(c.name)   ILIKE immutable_unaccent(${pattern}) ESCAPE '\\'
         OR immutable_unaccent(h.name)   ILIKE immutable_unaccent(${pattern}) ESCAPE '\\'
         OR immutable_unaccent(hlt.text) ILIKE immutable_unaccent(${pattern}) ESCAPE '\\'
      GROUP BY t.id
    `,
    );
    return rows;
  }

  /**
   * Date-anchored availability filter: the distinct ids of tours (optionally
   * scoped to a destination) that have a bookable OPEN departure on `date` with
   * enough remaining capacity for `guests`, in one of the `timeOfDay` buckets (if
   * any). Returns `[]` when nothing is available - the caller then yields zero
   * results, which is correct.
   *
   * Capacity (`capacity - bookedCount >= guests`) and the start-hour bucketing are
   * done in app code because Prisma cannot compare two columns in a `where` (same
   * approach as `AvailabilityService.checkAvailability`).
   */
  private async findDateAvailableTourIds(params: {
    destinationId?: string;
    date: Date;
    guests: number;
    timeOfDay: string[];
  }): Promise<string[]> {
    const { destinationId, date, guests, timeOfDay } = params;
    const buckets = timeOfDay
      .map((k) => ToursService.TIME_BUCKETS[k])
      .filter((b): b is [number, number] => Boolean(b));

    const departures = await this.prisma.departure.findMany({
      where: {
        date,
        status: DepartureStatus.OPEN,
        ...(destinationId && { tour: { destinationId } }),
      },
      select: {
        tourId: true,
        capacity: true,
        bookedCount: true,
        date: true,
        startTime: true,
        status: true,
        tour: { select: { timeZone: true, bookingCutoffMinutes: true } },
      },
    });

    const ids = new Set<string>();
    for (const d of departures) {
      // Same live-bookability rule as public availability + reserve: excludes
      // sold-out and past-cutoff departures (gaps #6/#15), not just OPEN status.
      if (
        !isDepartureLiveBookable({
          status: d.status,
          capacity: d.capacity,
          bookedCount: d.bookedCount,
          date: d.date,
          startTime: d.startTime,
          timeZone: d.tour.timeZone,
          bookingCutoffMinutes: d.tour.bookingCutoffMinutes,
          requiredSeats: guests,
        })
      )
        continue;
      if (buckets.length > 0) {
        const hour = d.startTime.getUTCHours();
        if (!buckets.some(([lo, hi]) => hour >= lo && hour < hi)) continue;
      }
      ids.add(d.tourId);
    }
    return [...ids];
  }

  /**
   * The filters the shared listing toolbar can set - price, duration, rating,
   * free-cancellation window, pickup - applied onto a where-clause in place.
   *
   * Lives here rather than inline in `findAll` because the SEARCH results page
   * mounts THE SAME toolbar (Pastel #44) and has to mean exactly the same thing
   * by it. Two copies of "what does the 4+ rating chip filter on" is two
   * behaviours a month from now.
   *
   * Date-anchored availability (`date`/`guests`/`timeOfDay`) is deliberately not
   * here: it narrows by id via {@link findDateAvailableTourIds}, and the two
   * callers compose that id list into their where-clause differently.
   */
  private applyToolbarFilters(
    where: Prisma.TourWhereInput,
    f: {
      minPrice?: number;
      maxPrice?: number;
      durationMin?: number;
      durationMax?: number;
      ratingMin?: number;
      cancellationMaxHours?: number;
      pickupAvailable?: boolean;
    },
  ): void {
    // Price filter runs against `priceFrom` (the displayed "From" anchor: default
    // participant band for PER_PERSON, basePrice for UNIT), so it agrees with the
    // price shown on the card - not the raw `basePrice`.
    if (f.minPrice !== undefined || f.maxPrice !== undefined) {
      where.priceFrom = {};
      if (f.minPrice !== undefined) where.priceFrom.gte = f.minPrice;
      if (f.maxPrice !== undefined) where.priceFrom.lte = f.maxPrice;
    }
    if (f.durationMin !== undefined || f.durationMax !== undefined) {
      where.durationMinutesFrom = {};
      if (f.durationMin !== undefined)
        where.durationMinutesFrom.gte = f.durationMin;
      if (f.durationMax !== undefined)
        where.durationMinutesFrom.lte = f.durationMax;
    }
    if (f.ratingMin !== undefined) where.aggregateRating = { gte: f.ratingMin };
    // Free-cancellation window: "I want to cancel up to N hours before" ->
    // only tours whose cutoff is <= N (cancellationHours is the hours-before
    // deadline; a smaller value is more flexible).
    if (f.cancellationMaxHours !== undefined)
      where.cancellationHours = { lte: f.cancellationMaxHours };
    // Pickup available = the tour offers pickup at all (any model but NONE).
    if (f.pickupAvailable) where.pickupModel = { not: PickupModel.NONE };
  }

  async findAll(query: TourQueryDto, rawQuery: Record<string, unknown> = {}) {
    const {
      search,
      destinationId,
      categoryId,
      categoryIds,
      hubId,
      isLocalsFavourite,
      pricingModel,
      minPrice,
      maxPrice,
      durationMin,
      durationMax,
      ratingMin,
      cancellationMaxHours,
      pickupAvailable,
      date,
      guests,
      timeOfDay,
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
    // Category filter: multi-select `categoryIds` (OR across the set) takes
    // precedence over the legacy single `categoryId`. A tour in ANY of the
    // selected categories matches.
    if (categoryIds && categoryIds.length > 0)
      where.categories = { some: { categoryId: { in: categoryIds } } };
    else if (categoryId) where.categories = { some: { categoryId } };
    if (hubId) where.hubs = { some: { hubId } };
    if (isLocalsFavourite !== undefined)
      where.isLocalsFavourite = isLocalsFavourite;
    if (pricingModel) where.pricingModel = pricingModel;
    this.applyToolbarFilters(where, {
      minPrice,
      maxPrice,
      durationMin,
      durationMax,
      ratingMin,
      cancellationMaxHours,
      pickupAvailable,
    });

    // Date-anchored availability filter (master §7.2): when a date is given, keep
    // only tours with an OPEN departure that day that fits `guests` and (if set)
    // the `timeOfDay` buckets. `guests`/`timeOfDay` do nothing without a date.
    // Departure.date is `@db.Date`, matched at midnight UTC.
    const parsedDate =
      date && !Number.isNaN(Date.parse(`${date}T00:00:00.000Z`))
        ? new Date(`${date}T00:00:00.000Z`)
        : null;
    if (parsedDate) {
      const availableTourIds = await this.findDateAvailableTourIds({
        destinationId,
        date: parsedDate,
        guests: guests ?? 1,
        timeOfDay: timeOfDay ?? [],
      });
      where.id = { in: availableTourIds };
    }

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
          // Localized title + overview + teaser for the card (title falls back
          // to the canonical name; overview backs the DYNAMIC collection card's
          // blurb; shortDescription backs the carousel description slide).
          translations: {
            where: { locale },
            select: { title: true, ...cardTeaserTranslationSelect },
          },
          // Destination slug so a listing item can build its flat URL even when
          // the list is not scoped to a single destination.
          destination: { select: { slug: true } },
          images: this.cardImagesArgs,
        },
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    const attributesByTour = await this.loadCardAttributes(
      data.map((t) => t.id),
    );

    const mapped = data.map(({ translations, destination, ...t }) => {
      const card = {
        ...this.flattenTour(t),
        title: translations[0]?.title ?? t.name,
        overview: translations[0]?.overview ?? null,
        shortDescription: cardTeaser(translations[0]),
        destinationSlug: destination?.slug ?? null,
        badge: this.deriveTourBadge(t),
        attributes: attributesByTour.get(t.id) ?? [],
      };
      this.neutralizeApprovalFields(card);
      return card;
    });

    // §3.8 diversity pass runs after ranking, on the default ("recommended") sort
    // only - explicit price/rating sorts keep the exact order the user requested.
    const ordered =
      sort === TourSort.recommended ? this.applyDiversityPass(mapped) : mapped;
    // §3.6 "max 1 per category" cap on the Most popular badge, in display order.
    this.applyMostPopularCap(ordered);

    await this.attachMoney(ordered, query.currency);
    // Only the commercial half here - the approval fields were already
    // neutralized per-card above. Must run AFTER applyMostPopularCap, which
    // reads `tierRank`.
    ordered.forEach((t) => this.neutralizeCommercialFields(t));
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
   * Recomputes the §7.2 `quality_score` (0-100) for every LIVE tour and writes
   * it to `tour.qualityScore` - the within-tier tie-breaker of the canonical
   * ranking (`tier_rank ASC, quality_score DESC, id ASC`). Formula, weights and
   * the listing-completeness checklist live in `src/tours/quality-score.ts`
   * (single source of truth). Runs nightly (NightlyJobsService) and on demand.
   *
   * The conversion term (15) is category-relative (`conversion / max_conv` among
   * active tours in the same primary category). Until pageview tracking lands
   * there is no conversion data, so the term contributes 0 for every tour.
   */
  async recomputeQualityScores(): Promise<{ evaluated: number }> {
    const tours = await this.prisma.tour.findMany({
      where: { status: TourStatus.LIVE, isActive: true },
      select: {
        id: true,
        aggregateRating: true,
        aggregateReviewCount: true,
        meetingPointLat: true,
        meetingPointLng: true,
        departureCity: true,
        // EN is the canonical content locale - completeness reads the base copy.
        translations: {
          where: { locale: Locale.en },
          select: { overview: true, shortDescription: true },
        },
        _count: {
          select: {
            images: true,
            highlights: true,
            inclusions: true,
            exclusions: true,
            languages: true,
            attributes: true,
            locations: true,
          },
        },
      },
    });

    for (const t of tours) {
      const en = t.translations[0];
      const completeness = listingCompleteness({
        imageCount: t._count.images,
        hasOverview: Boolean(en?.overview?.trim()),
        hasShortDescription: Boolean(en?.shortDescription?.trim()),
        highlightCount: t._count.highlights,
        inclusionCount: t._count.inclusions,
        exclusionCount: t._count.exclusions,
        languageCount: t._count.languages,
        attributeCount: t._count.attributes,
        hasMeetingPoint:
          (t.meetingPointLat != null && t.meetingPointLng != null) ||
          Boolean(t.departureCity?.trim()),
        locationCount: t._count.locations,
      });
      const score = computeQualityScore({
        avgRating: t.aggregateRating,
        reviewCount: t.aggregateReviewCount,
        completeness,
        conversionRate: null, // no pageview tracking yet - term contributes 0
        maxCategoryConversion: null,
      });
      await this.prisma.tour.update({
        where: { id: t.id },
        data: { qualityScore: score },
      });
    }
    this.logger.log(
      `recomputeQualityScores: evaluated ${tours.length} tour(s)`,
    );
    return { evaluated: tours.length };
  }

  /**
   * Maps the requested sort to a Prisma orderBy. Full write-up:
   * technical-doc/03-implementation/TOUR-RANKING.md.
   *
   * The DEFAULT ("recommended", shown to travelers as "Locals' favorites") is the
   * canonical platform ranking from master §7.2, with the Spotlight placements
   * leading (product decision 2026-07-18 - the master's "separate labeled block"
   * is realized as spotlight-first within the single grid):
   *
   *     is_sponsored DESC, tier_rank ASC, quality_score DESC, id ASC
   *
   * - `is_sponsored` = ACTIVE Destination Spotlight (max 3/destination) - those
   *   tours lead the list and are the only ones wearing the Sponsored badge.
   * - `tier_rank` (1=premium … 5=standard) is denormalized from the operator's
   *   commission tier, so paid placements naturally float to the top.
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
        // Spotlight placements first, then the master §7.2 canonical order.
        return [
          { isSponsored: 'desc' },
          { tierRank: 'asc' },
          { qualityScore: 'desc' },
          { id: 'asc' },
        ];
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
   * Master §3.6: the "Most popular" badge is capped at MAX 1 PER CATEGORY.
   * Page-local like the diversity pass: walking the final display order, the
   * first tour of each primary category keeps the badge; later ones fall back
   * to the next badge down the priority - 'sponsored' when the tour is a paid
   * placement (spotlight or tier P1-P3), otherwise no badge ('new' can never
   * apply here: it needs zero reviews, mostPopular needs >= 10). Mutates in
   * place.
   */
  private applyMostPopularCap<
    T extends {
      badge: TourBadge;
      primaryCategoryId: string | null;
      isSponsored: boolean;
      tierRank: number;
    },
  >(items: T[]): T[] {
    return applyMostPopularCap(items);
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

    const valuesOf = (key: string) =>
      String(rawQuery[key])
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);

    const filters: Prisma.TourWhereInput[] = [];

    // Derived keys are filtered against the first-class Tour columns (single
    // source of truth), never the tour_attributes join. Genuine attributes go
    // through the dictionary + the attributes.some join below.
    const genuineCandidates: string[] = [];
    for (const key of candidates) {
      if (DERIVED_ATTRIBUTE_KEYS.has(key)) {
        const where = buildDerivedAttributeWhere(key, valuesOf(key));
        if (where) filters.push(where);
      } else {
        genuineCandidates.push(key);
      }
    }

    if (genuineCandidates.length > 0) {
      const defs = await this.prisma.attributeDefinition.findMany({
        where: {
          key: { in: genuineCandidates },
          isFilterable: true,
          isActive: true,
        },
        select: { key: true },
      });
      const validKeys = new Set(defs.map((d) => d.key));
      for (const key of genuineCandidates) {
        if (!validKeys.has(key)) continue;
        const values = valuesOf(key);
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
    }
    return filters;
  }

  // ── Admin all tours ───────────────────────────────────────────────────────────

  async findAllAdmin(query: AdminToursQueryDto) {
    const {
      search,
      status,
      approvalStatus,
      operatorId,
      destinationId,
      isLocalsFavourite,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TourWhereInput = {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (operatorId) where.operatorId = operatorId;
    if (destinationId) where.destinationId = destinationId;
    if (isLocalsFavourite !== undefined)
      where.isLocalsFavourite = isLocalsFavourite;

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
              highlights: true,
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

  /**
   * The dashboard's tours list, scoped by WHO is asking.
   *
   * An operator gets their own catalogue - that is the whole point of the
   * route. A platform-wide role (ADMIN / STAFF / EDITOR) has no operator record
   * to resolve, and resolution throws for them, so this used to answer
   * "No operator profile found. Please complete your operator registration
   * first." to an invited platform staff member - who saw an empty Tours screen
   * (test report 2026-08-01 §Admin.4). They get the platform catalogue instead,
   * which is what `VIEW_TRIPS` means on that side of the line.
   *
   * No widening for operators: the operator branch is unchanged, and the scope
   * is decided from the SESSION role, never from a query param.
   */
  async findMyTours(userId: string, userRole: Role, query: MyToursQueryDto) {
    const operatorId = isPlatformWideRole(userRole)
      ? null
      : await this.resolveOperatorId(userId, userRole);
    const {
      search,
      status,
      approvalStatus,
      destinationId,
      page = 1,
      limit = 20,
    } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TourWhereInput = operatorId ? { operatorId } : {};
    if (search) where.name = { contains: search, mode: 'insensitive' };
    if (status) where.status = status;
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (destinationId) where.destinationId = destinationId;

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
          // Only meaningful on the platform-wide read: an operator looking at
          // their own catalogue already knows whose it is, and `flattenCounts`
          // drops the relation when it is absent. Same shape as
          // `findAllAdmin`, so the dashboard's Operator column reads one field
          // whichever route answered.
          ...(operatorId
            ? {}
            : {
                operator: {
                  select: {
                    id: true,
                    companyInfo: { select: { companyName: true } },
                    user: { select: { name: true, email: true } },
                  },
                },
              }),
          _count: {
            select: {
              images: true,
              highlights: true,
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

  async findOne(
    id: string,
    requesterId: string | null,
    requesterRole: Role | null,
    target?: Currency,
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
            highlights: true,
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

    const result = this.flattenCounts(tour);
    await this.attachMoney([result], target);
    // Strip the review fields for everyone who is NOT platform staff or the
    // owning operator - "not anonymous" is a much bigger set than
    // "authorized" (any customer account would otherwise read the admin's
    // review note on a LIVE tour).
    const isPlatform =
      requesterRole === Role.ADMIN ||
      requesterRole === Role.STAFF ||
      requesterRole === Role.EDITOR;
    const isOwner =
      requesterRole === Role.TOUR_OPERATOR &&
      requesterId != null &&
      tour.operatorId ===
        (await this.resolveOperatorId(requesterId, requesterRole).catch(
          () => null,
        ));
    if (!isPlatform && !isOwner) {
      this.neutralizeForPublic(result);
    }
    return result;
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
        // Operator display name for the public detail page (review response
        // author, "Supplied by" on the cancellation policy). companyName wins,
        // else the account name.
        operator: {
          select: {
            companyInfo: { select: { companyName: true } },
            user: { select: { name: true } },
          },
        },
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
            localTipTitle: true,
            localTipBody: true,
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
            price: true,
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
      highlights,
      inclusions,
      exclusions,
      locations,
      pickupLocations,
      features,
      languages,
      operator,
      ...rest
    } = tour;

    // PER-FIELD, not per-row: a field cleared in the Translation Console
    // leaves the locale row in place with a NULL in it, and row-level fallback
    // would render that as empty instead of showing English.
    const resolvedTranslation = mergeTranslation(translations, locale) ?? null;

    const resolvedHighlights = highlights.map((h) => ({
      id: h.id,
      displayOrder: h.displayOrder,
      text: mergeTranslation(h.translations, locale)?.text ?? '',
    }));

    const resolvedInclusions = inclusions.map((i) => ({
      id: i.id,
      icon: i.icon,
      displayOrder: i.displayOrder,
      label: mergeTranslation(i.translations, locale)?.label ?? '',
    }));

    const resolvedExclusions = exclusions.map((e) => ({
      id: e.id,
      icon: e.icon,
      type: e.type,
      priceText: e.priceText,
      displayOrder: e.displayOrder,
      label: mergeTranslation(e.translations, locale)?.label ?? '',
    }));

    const resolvedLocations = locations.map((l) => {
      const tr = mergeTranslation(l.translations, locale);
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
      const tr = mergeTranslation(p.translations, locale);
      return {
        id: p.id,
        name: p.name,
        latitude: p.latitude,
        longitude: p.longitude,
        address: p.address,
        // Source-currency string; the frontend converts with the same money.fxRate
        // it already applies to age-band and add-on prices.
        price: p.price != null ? p.price.toString() : null,
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
      text: mergeTranslation(f.translations, locale)?.text ?? '',
    }));

    const detail = {
      ...this.flattenTour(rest),
      operatorName:
        operator?.companyInfo?.companyName ?? operator?.user?.name ?? null,
      translation: resolvedTranslation,
      ageBands: rest.ageBands,
      highlights: resolvedHighlights,
      inclusions: resolvedInclusions,
      exclusions: resolvedExclusions,
      locations: resolvedLocations,
      pickupLocations: resolvedPickupLocations,
      features: resolvedFeatures,
      languages: languages.map((l) => l.language),
    };
    this.neutralizeForPublic(detail);
    // The DETAIL variant, not the card one: it also converts the age bands,
    // add-ons, priced pickup zones and the extra-guest surcharge, so the booking
    // widget can price its estimate off served numbers instead of running its
    // own FX multiply and landing on figures this service never produced
    // (Pastel #41).
    await this.fx.attachDetailMoney(detail, query.currency);
    return detail;
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

    // Client review #12 / master 2.3: the slug is a destination-registry
    // entry set by Island Tours, never operator-authored. A non-admin's slug
    // is IGNORED rather than rejected - older dashboards send an auto-derived
    // slug on every create, and a 400 would break them for a copy decision -
    // and the address derives from the name instead (provisional until the
    // review flow sets it from the final title).
    const baseSlug =
      userRole === Role.ADMIN && dto.slug
        ? generateSlug(dto.slug)
        : generateSlug(dto.name);

    // Validate destination
    const destination = await this.prisma.destination.findUnique({
      where: { id: dto.destinationId },
      select: { id: true, slug: true, isActive: true, timezone: true },
    });
    if (!destination || !destination.isActive) {
      throw new BadRequestException('Destination not found or is not active');
    }

    // A tour's local schedule/departure math is anchored to the destination's
    // IANA timezone - never a universal Curaçao fallback, which would silently
    // put non-Curaçao islands (Aruba, Bahamas, ...) on the wrong clock.
    // Capture into a local const so the narrowed `string` survives into the
    // transaction closure below.
    const tourTimeZone = destination.timezone;
    if (!isValidIanaTimeZone(tourTimeZone)) {
      throw new BadRequestException(
        'Destination is missing a valid IANA timezone; set it on the destination before creating tours',
      );
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

    // Same range guard as `update` - an API client can send both ends at once,
    // and the schema defaults (1 / 10) hold whichever end is omitted.
    const createMin = dto.minPartySize ?? 1;
    const createMax = dto.maxPartySize ?? DEFAULT_MAX_PARTY_SIZE;
    if (createMin > createMax) {
      throw new BadRequestException(
        `minPartySize (${createMin}) cannot exceed maxPartySize (${createMax})`,
      );
    }
    if ((dto.meetingPointLat == null) !== (dto.meetingPointLng == null)) {
      throw new BadRequestException(
        'A meeting point needs both a latitude and a longitude',
      );
    }

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
        await this.assertHubAllowsCategories(
          tx,
          hubId,
          dto.destinationId,
          categoryIds,
        );
      }

      const tour = await tx.tour
        .create({
          data: {
            name: dto.name,
            slug,
            operatorId,
            destinationId: dto.destinationId,
            timeZone: tourTimeZone,
            pricingModel: dto.pricingModel,
            // Unit fields only apply to UNIT pricing; force them null for
            // PER_PERSON so the two models never carry each other's data.
            wholeUnitType:
              dto.pricingModel === PricingModel.UNIT
                ? (dto.wholeUnitType ?? null)
                : null,
            ...(dto.defaultCurrency !== undefined && {
              defaultCurrency: dto.defaultCurrency,
            }),
            basePrice: dto.basePrice ?? null,
            priceFrom: dto.basePrice ?? null, // from = base; recomputed from bands (PER_PERSON) or kept as base (UNIT)
            // Included-guests + extra-person surcharge applies ONLY to GROUP unit
            // pricing. Boat/vehicle/aircraft/package charters are a flat unit price.
            unitIncludedGuests:
              dto.pricingModel === PricingModel.UNIT &&
              dto.wholeUnitType === WholeUnitType.GROUP
                ? (dto.unitIncludedGuests ?? null)
                : null,
            extraPersonPrice:
              dto.pricingModel === PricingModel.UNIT &&
              dto.wholeUnitType === WholeUnitType.GROUP
                ? (dto.extraPersonPrice ?? null)
                : null,
            durationMinutesFrom: dto.durationMinutesFrom ?? null,
            durationMinutesTo: dto.durationMinutesTo ?? null,
            pickupModel: dto.pickupModel,
            pickupRequired: dto.pickupRequired ?? false,
            // NOT NULL since 20260729190000. `undefined` falls through to the
            // schema default (10) rather than writing null, which is what lets
            // the wizard mint a draft from four fields and ask for the real
            // capacity on the booking-rules step.
            maxPartySize: dto.maxPartySize,
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
            ...(dto.onArrivalPayment !== undefined && {
              onArrivalPayment: dto.onArrivalPayment,
            }),
            bookingType: dto.bookingType ?? null,
            meetingPointLat: dto.meetingPointLat ?? null,
            meetingPointLng: dto.meetingPointLng ?? null,
            checkInMinutesBefore: dto.checkInMinutesBefore ?? 30,
            departureCity: dto.departureCity ?? null,
            minAgeYears: dto.minAgeYears ?? null,
            fitnessLevel: dto.fitnessLevel ?? null,
            ...(dto.sleepAboard !== undefined && {
              sleepAboard: dto.sleepAboard,
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

    // Party size is a RANGE, and either end can arrive alone - so the guard has
    // to compare the incoming value against the stored one, not just against
    // its sibling in the same body. Unguarded, min > max produces departures
    // whose capacity can never satisfy their own minimum: bookable in the grid,
    // impossible at checkout.
    const nextMin = dto.minPartySize ?? tour.minPartySize;
    const nextMax = dto.maxPartySize ?? tour.maxPartySize;
    if (nextMin > nextMax) {
      throw new BadRequestException(
        `minPartySize (${nextMin}) cannot exceed maxPartySize (${nextMax})`,
      );
    }

    // Half a meeting point is not a meeting point: one axis alone cannot be
    // plotted on the tour page or the confirmation email, so it is stored data
    // nothing can ever read. Resolved against the stored row for the same
    // reason as the party range - either axis can arrive on its own.
    const nextLat =
      dto.meetingPointLat !== undefined
        ? dto.meetingPointLat
        : tour.meetingPointLat;
    const nextLng =
      dto.meetingPointLng !== undefined
        ? dto.meetingPointLng
        : tour.meetingPointLng;
    if ((nextLat == null) !== (nextLng == null)) {
      throw new BadRequestException(
        'A meeting point needs both a latitude and a longitude',
      );
    }

    // Free-cancellation window is admin-only once the tour has left DRAFT:
    // booking deadlines are computed from it at read time (E.8), so changing
    // it on a live tour retroactively moves EXISTING bookings' cancellation
    // deadlines (access-roles matrix, Tours notes).
    if (
      dto.cancellationHours !== undefined &&
      dto.cancellationHours !== tour.cancellationHours &&
      tour.status !== TourStatus.DRAFT &&
      requesterRole !== Role.ADMIN
    ) {
      throw new ForbiddenException(
        "The free-cancellation window cannot be changed on a published tour - it would move existing bookings' cancellation deadlines. Contact Island Tours to change it.",
      );
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
    // ADMIN only (client review #12): the slug is Island Tours' registry
    // entry. A non-admin's slug is ignored, not rejected - the operator
    // wizard passes the stored slug back on every byte-identical save, and
    // rejecting it would break every operator save during the deploy window.
    let renameFrom: string | undefined;
    let renameTo: string | undefined;
    if (dto.slug !== undefined && requesterRole === Role.ADMIN) {
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
          ...(dto.defaultCurrency !== undefined && {
            defaultCurrency: dto.defaultCurrency,
          }),
          ...(dto.basePrice !== undefined && { basePrice: dto.basePrice }),
          // Unit fields: applied for UNIT, force-nulled for PER_PERSON (the two
          // models never carry each other's data). Within UNIT, the included-guests
          // + extra-person surcharge applies ONLY to the GROUP unit type; other
          // charters (boat/vehicle/aircraft/package) are a flat unit price. Uses
          // the effective model/unit-type (incoming dto value, else the tour's).
          ...((dto.pricingModel ?? tour.pricingModel) === PricingModel.UNIT
            ? {
                ...(dto.wholeUnitType !== undefined && {
                  wholeUnitType: dto.wholeUnitType,
                }),
                ...((dto.wholeUnitType ?? tour.wholeUnitType) ===
                WholeUnitType.GROUP
                  ? {
                      ...(dto.unitIncludedGuests !== undefined && {
                        unitIncludedGuests: dto.unitIncludedGuests,
                      }),
                      ...(dto.extraPersonPrice !== undefined && {
                        extraPersonPrice: dto.extraPersonPrice,
                      }),
                    }
                  : { unitIncludedGuests: null, extraPersonPrice: null }),
              }
            : {
                wholeUnitType: null,
                unitIncludedGuests: null,
                extraPersonPrice: null,
              }),
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
          ...(dto.availabilityType !== undefined && {
            availabilityType: dto.availabilityType,
          }),
          ...(dto.redemptionMethod !== undefined && {
            redemptionMethod: dto.redemptionMethod,
          }),
          ...(dto.instantDelivery !== undefined && {
            instantDelivery: dto.instantDelivery,
          }),
          ...(dto.availabilityRequired !== undefined && {
            availabilityRequired: dto.availabilityRequired,
          }),
          ...(dto.allowFreesale !== undefined && {
            allowFreesale: dto.allowFreesale,
          }),
          ...(dto.deliveryFormats !== undefined && {
            deliveryFormats: dto.deliveryFormats,
          }),
          ...(dto.deliveryMethods !== undefined && {
            deliveryMethods: dto.deliveryMethods,
          }),
          // timeZone is derived from the destination on create and never
          // operator-editable, so it is intentionally not updated here.
          ...(dto.paymentModel !== undefined && {
            paymentModel: dto.paymentModel,
          }),
          // Not retroactive (rule #21): each booking snapshots its own terms at
          // reserve, so changing this only affects future bookings.
          ...(dto.onArrivalPayment !== undefined && {
            onArrivalPayment: dto.onArrivalPayment,
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
          ...(dto.sleepAboard !== undefined && {
            sleepAboard: dto.sleepAboard,
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
          // isLocalsFavourite is editorial-only (MANAGE_EDITORIAL); not writable here.
          ...(dto.likelyToSellOutOverride !== undefined && {
            likelyToSellOutOverride: dto.likelyToSellOutOverride,
          }),
          ...(dto.reference !== undefined && { reference: dto.reference }),
          ...(dto.ogImage !== undefined && { ogImage: dto.ogImage }),
          // `new Date(null)` is the epoch, not null - so an explicit null,
          // which every other nullable column here treats as "clear it", would
          // have stamped 1970-01-01 as the confirmation date.
          ...(dto.availabilityConfirmedAt !== undefined && {
            availabilityConfirmedAt: dto.availabilityConfirmedAt
              ? new Date(dto.availabilityConfirmedAt)
              : null,
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
          await this.assertHubAllowsCategories(
            tx,
            hubId,
            tour.destinationId,
            effectiveCategoryIds,
          );
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

    // Keep the "From $X" anchor in sync when basePrice or the pricing model
    // changed (UNIT anchors on basePrice, PER_PERSON on the cheapest band).
    if (dto.basePrice !== undefined || dto.pricingModel !== undefined) {
      updated.priceFrom = await this.recomputePriceFrom(id);
    }

    // maxPartySize is the default departure capacity. When it changes, schedules
    // that had no capacity override can now (or can no longer) materialise, so
    // re-project departures and refresh the listing gate immediately instead of
    // waiting for the nightly job. This is what makes a tour whose schedules were
    // silently skipped for lack of capacity self-heal the moment a size is set.
    if (
      dto.maxPartySize !== undefined &&
      dto.maxPartySize !== tour.maxPartySize
    ) {
      await this.availability.resyncTourAvailability(id);
    }

    this.logger.log(`User ${requesterId} updated tour ${id}`);
    return { tour: this.flattenTour(updated), warnings };
  }

  // ── Lifecycle transitions ─────────────────────────────────────────────────────

  /** The tour + child counts the publish-precondition check needs. */
  private async loadTourForReadiness(id: string) {
    const tour = await this.prisma.tour.findUnique({
      where: { id },
      select: {
        ...this.tourSelect,
        images: { select: { id: true, isHero: true } },
        highlights: { select: { id: true } },
        translations: {
          where: { locale: Locale.en },
          select: { overview: true, shortDescription: true },
        },
        _count: { select: { ageBands: true } },
      },
    });
    if (!tour) throw new NotFoundException(`Tour ${id} not found`);
    return tour;
  }

  /**
   * The listing-readiness bar, shared by publish() AND submitForReview() so a
   * review is never wasted on an incomplete tour and the two gates can never
   * drift apart.
   */
  private collectPublishBlockers(
    tour: Awaited<ReturnType<typeof this.loadTourForReadiness>>,
    verb: 'publish' | 'submit for review',
  ): string[] {
    const errors: string[] = [];
    if (tour.images.length < 5)
      errors.push(`At least 5 images are required to ${verb}`);
    if (!tour.images.some((img) => img.isHero))
      errors.push(`A hero image must be set to ${verb}`);

    const enTranslation = tour.translations[0];
    if (!enTranslation?.overview?.trim())
      errors.push(`An English overview is required to ${verb}`);

    if (tour.highlights.length < 3)
      errors.push(`At least 3 highlights are required to ${verb}`);

    // Price required, per pricing model:
    // - UNIT (whole-unit / charter): a base price (the whole-unit price) + a unit type.
    // - PER_PERSON: at least one priced age band, or a flat base-price fallback.
    if (tour.pricingModel === PricingModel.UNIT) {
      if (tour.basePrice == null)
        errors.push(
          `Unit-priced tours require a base price (the whole-unit price) to ${verb}`,
        );
      if (!tour.wholeUnitType)
        errors.push(
          `Unit-priced tours require a unit type (group / boat / vehicle / aircraft / package) to ${verb}`,
        );
    } else if (tour.basePrice == null && tour._count.ageBands === 0) {
      errors.push(
        `A price is required to ${verb} (set a base price or add an age band)`,
      );
    }
    return errors;
  }

  /**
   * Operator submits a DRAFT tour for platform review (conflict #1: publishing
   * is always Island Tours'). Runs the SAME readiness bar as publish so the
   * review queue never holds incomplete tours. Allowed from NOT_SUBMITTED or
   * REJECTED (a fix-and-resubmit clears the old review note).
   */
  async submitForReview(id: string, userId: string, userRole: Role) {
    const tour = await this.loadTourForReadiness(id);
    await this.assertOwnership(tour, userId, userRole);
    if (!REVIEWABLE_STATUSES.includes(tour.status)) {
      throw new BadRequestException(
        'A live tour is already published - pause or archive it first',
      );
    }
    if (tour.approvalStatus === TourApprovalStatus.PENDING) {
      throw new ConflictException(
        'This tour is already awaiting review - Island Tours will get back to you',
      );
    }
    if (tour.approvalStatus === TourApprovalStatus.APPROVED) {
      throw new ConflictException(
        'This tour is already approved - Island Tours publishes it from here',
      );
    }

    const errors = this.collectPublishBlockers(tour, 'submit for review');
    if (errors.length > 0) throw new BadRequestException(errors);

    const updated = await this.prisma.tour.update({
      where: { id },
      data: {
        approvalStatus: TourApprovalStatus.PENDING,
        submittedAt: new Date(),
        reviewNote: null,
      },
      select: this.tourSelect,
    });
    this.logger.log(`User ${userId} submitted tour ${id} for review`);
    this.notifyReviewSubmitted(id);
    this.inbox.notify({
      event: InboxEvent.TOUR_SUBMITTED_FOR_REVIEW,
      operatorId: tour.operatorId,
      title: `${tour.name} was submitted for review`,
      body: 'It has passed the readiness bar and is waiting for an editorial decision.',
      url: this.tourReviewPath(id),
      entityType: 'tour',
      entityId: id,
      actorUserId: userId,
      // A resubmission after changes is a NEW thing to look at, so the round
      // has to be part of the key - otherwise the second submission dedupes
      // against the first and the queue silently loses it.
      dedupeKey: `TOUR_SUBMITTED_FOR_REVIEW:${id}:${updated.submittedAt?.toISOString() ?? ''}`,
    });
    return this.flattenTour(updated);
  }

  /** Admin approves a PENDING submission. Publishing stays a separate step. */
  async approveTour(id: string, adminId: string, note?: string) {
    const tour = await this.findTourOrThrow(id);
    if (
      !REVIEWABLE_STATUSES.includes(tour.status) ||
      tour.approvalStatus !== TourApprovalStatus.PENDING
    ) {
      throw new ConflictException(
        'Only a tour awaiting review can be approved',
      );
    }
    const updated = await this.prisma.tour.update({
      where: { id },
      data: {
        approvalStatus: TourApprovalStatus.APPROVED,
        reviewNote: note?.trim() || null,
      },
      select: this.tourSelect,
    });
    this.logger.log(`Admin ${adminId} approved tour ${id}`);
    this.inbox.notify({
      event: InboxEvent.TOUR_APPROVED,
      operatorId: tour.operatorId,
      title: `${tour.name} was approved`,
      body: 'Island Tours publishes it from here - no action needed from you.',
      url: this.tourReviewPath(id),
      entityType: 'tour',
      entityId: id,
      actorUserId: adminId,
      dedupeKey: `TOUR_APPROVED:${id}:${Date.now()}`,
    });
    // APPROVED is not LIVE: publishing is a separate admin action, so the copy
    // must not congratulate the operator on a page nobody can visit yet.
    this.notifyApproved(id, note?.trim() || undefined);
    return this.flattenTour(updated);
  }

  /** Admin rejects a PENDING submission with a required, actionable note. */
  async rejectTour(id: string, adminId: string, note: string) {
    const tour = await this.findTourOrThrow(id);
    if (
      !REVIEWABLE_STATUSES.includes(tour.status) ||
      tour.approvalStatus !== TourApprovalStatus.PENDING
    ) {
      throw new ConflictException(
        'Only a tour awaiting review can be rejected',
      );
    }
    const updated = await this.prisma.tour.update({
      where: { id },
      data: {
        approvalStatus: TourApprovalStatus.REJECTED,
        reviewNote: note.trim(),
      },
      select: this.tourSelect,
    });
    this.logger.log(`Admin ${adminId} rejected tour ${id}`);
    this.inbox.notify({
      event: InboxEvent.TOUR_CHANGES_REQUESTED,
      operatorId: tour.operatorId,
      title: `Changes requested on ${tour.name}`,
      body: note.trim(),
      url: this.tourReviewPath(id),
      entityType: 'tour',
      entityId: id,
      actorUserId: adminId,
      dedupeKey: `TOUR_CHANGES_REQUESTED:${id}:${Date.now()}`,
    });
    this.notifyChangesRequested(id, note.trim());
    return this.flattenTour(updated);
  }

  /**
   * The two halves of the review round trip, as email.
   *
   * Both are fire-and-forget: a submission that entered the queue and a verdict
   * that is already on the row must not be rolled back because Resend is down.
   * A failure is logged and the dashboard remains the system of record.
   *
   * Both load their own recipient rather than widening `tourSelect`. That
   * select feeds every PUBLIC tour payload - putting an operator's contact
   * email in it would publish it to travellers.
   */
  private notifyReviewSubmitted(tourId: string): void {
    void (async () => {
      // ADMIN_EMAIL is the same reviewer mailbox the cancellation flow uses.
      // Unlike that flow this does NOT fail the action when it is unset: the
      // tour is in the queue either way, and refusing the submission would
      // punish the operator for our configuration.
      const adminTo = process.env.ADMIN_EMAIL?.trim() || undefined;
      // INT-2: the sales pipeline hears about submissions too. Only a
      // DISTINCT sales mailbox gets the variant - when the resolved sales
      // address (WP-H: stored setting ?? SALES_EMAIL ?? ADMIN_EMAIL env)
      // falls back to ADMIN_EMAIL the reviewer email above is the one and
      // only send. The comparison is case-insensitive: mailboxes are, and a
      // casing mismatch would double-send to the same inbox.
      const salesTo = (await this.emailSettings.resolve()).salesEmail;
      const distinctSalesTo =
        salesTo && salesTo.toLowerCase() !== adminTo?.toLowerCase()
          ? salesTo
          : null;

      if (!adminTo) {
        this.logger.error(
          distinctSalesTo
            ? `ADMIN_EMAIL is not configured - tour ${tourId} entered the review queue with no reviewer notified (sales alert still sent)`
            : `No reviewer or sales mailbox is configured - tour ${tourId} entered the review queue with nobody notified`,
        );
        if (!distinctSalesTo) return;
      }

      const tour = await this.prisma.tour.findUnique({
        where: { id: tourId },
        select: {
          name: true,
          submittedAt: true,
          destination: { select: { name: true } },
          operator: {
            select: {
              companyInfo: { select: { companyName: true } },
              user: { select: { name: true } },
            },
          },
        },
      });
      if (!tour) return;
      const operatorName =
        tour.operator?.companyInfo?.companyName ??
        tour.operator?.user?.name ??
        'An operator';
      const sends: Promise<void>[] = [];
      if (adminTo) {
        sends.push(
          this.mail.sendTourSubmittedForReviewEmail(adminTo, {
            tourName: tour.name,
            operatorName,
            destinationName: tour.destination?.name ?? 'the Caribbean',
            reviewUrl: this.tourReviewUrl(tourId),
          }),
        );
      }
      if (distinctSalesTo) {
        sends.push(
          this.mail.sendTourSubmittedSalesEmail(distinctSalesTo, {
            tourName: tour.name,
            operatorName,
            submittedAt: tour.submittedAt ?? new Date(),
            reviewUrl: this.tourReviewUrl(tourId),
          }),
        );
      }
      await Promise.all(sends);
    })().catch((err: unknown) =>
      this.logger.error(
        `Review-submitted email failed for tour ${tourId}`,
        err instanceof Error ? err.stack : String(err),
      ),
    );
  }

  private notifyChangesRequested(tourId: string, note: string): void {
    this.notifyOperator(tourId, 'Changes-requested', (target) =>
      this.mail.sendTourChangesRequestedEmail(target.to, {
        tourName: target.tourName,
        note,
        editUrl: this.tourReviewUrl(tourId),
        name: target.name,
      }),
    );
  }

  private notifyApproved(tourId: string, note?: string): void {
    this.notifyOperator(tourId, 'Approved', (target) =>
      this.mail.sendTourApprovedEmail(target.to, {
        tourName: target.tourName,
        note,
        tourUrl: this.tourReviewUrl(tourId),
        name: target.name,
      }),
    );
  }

  /**
   * Resolve the operator's mailbox for a verdict email and send it, off the
   * request path.
   *
   * Shared by both verdicts because both answer the same question - "who at
   * this operator hears about their tour?" - and a second copy of that answer
   * would be one more place for the contactEmail fallback to drift.
   */
  private notifyOperator(
    tourId: string,
    label: string,
    send: (target: {
      to: string;
      tourName: string;
      name?: string;
    }) => Promise<void>,
  ): void {
    void this.prisma.tour
      .findUnique({
        where: { id: tourId },
        select: {
          name: true,
          operator: {
            select: {
              contactEmail: true,
              user: { select: { name: true, email: true } },
            },
          },
        },
      })
      .then((tour) => {
        // The operator's own contact address first, the owner account's login
        // second - a company that routes tour admin to a shared inbox has said
        // so by filling in `contactEmail`.
        const to = tour?.operator?.contactEmail ?? tour?.operator?.user?.email;
        if (!tour || !to) {
          this.logger.error(
            `Tour ${tourId}: ${label.toLowerCase()} verdict has no operator email to reach - it lands only in the dashboard`,
          );
          return;
        }
        return send({
          to,
          tourName: tour.name,
          name: tour.operator?.user?.name ?? undefined,
        });
      })
      .catch((err: unknown) =>
        this.logger.error(
          `${label} email failed for tour ${tourId}`,
          err instanceof Error ? err.stack : String(err),
        ),
      );
  }

  /** The wizard's review screen - where both audiences need to land. */
  private tourReviewUrl(tourId: string): string {
    return `${dashboardAppBase()}${this.tourReviewPath(tourId)}`;
  }

  /**
   * The same destination, dashboard-RELATIVE. Inbox rows store relative paths:
   * they outlive a domain change, and a stored absolute URL is something a
   * future bug could point off-site.
   */
  private tourReviewPath(tourId: string): string {
    return `/trips/${tourId}/edit?step=review`;
  }

  async publish(id: string, userId: string, userRole: Role) {
    const tour = await this.loadTourForReadiness(id);
    await this.assertOwnership(tour, userId, userRole);
    if (tour.status !== TourStatus.DRAFT) {
      throw new BadRequestException('Tour must be in DRAFT status to publish');
    }
    // Conflict #1: publish requires an approved review. The route is
    // MANAGE_TRIPS (platform-only; operators lost it - they submit for
    // review instead). An ADMIN publishing an unreviewed tour IS the review
    // (their publish stamps the approval). A platform-STAFF account granted
    // MANAGE_TRIPS via a designation can review (approve/reject) but still
    // cannot skip the gate here - only the real ADMIN role bypasses.
    if (
      userRole !== Role.ADMIN &&
      tour.approvalStatus !== TourApprovalStatus.APPROVED
    ) {
      throw new ConflictException(
        'Tour must be approved before publishing (submit it for review first)',
      );
    }

    const errors = this.collectPublishBlockers(tour, 'publish');
    if (errors.length > 0) throw new BadRequestException(errors);

    // Compute bookability at publish time so the tour appears in listings
    // immediately if it already has availability (the public grid gates on
    // isBookable). If it has no bookable departure yet, it stays hidden until the
    // operator adds availability - the dashboard surfaces this so it is not silent.
    const bookable = await this.availability.computeIsBookable(id);
    const now = new Date();
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.tour.update({
        where: { id },
        data: {
          status: TourStatus.LIVE,
          publishedAt: now,
          // Stamped ONCE, on the first publish, and never moved by a later
          // pause/republish - unlike `publishedAt`, which tracks the current
          // spell. Nothing wrote it before, so it was null on every tour the app
          // published: the tier engine read that as "still provisional" and
          // exempted those tours from demotion forever (tiers.service
          // `isInProvisionalWindow` returns true for null), and the wizard could
          // never mark its review step done. The demo seed always set it, which
          // is why seeded data looked correct and published data did not.
          firstPublishedAt: tour.firstPublishedAt ?? now,
          isBookable: bookable,
          // LIVE implies APPROVED: an admin publish is itself the approval.
          approvalStatus: TourApprovalStatus.APPROVED,
        },
        select: this.tourSelect,
      });

      // Operator onboarding anchor (plan §2.4): the operator's FIRST tour
      // going live is stamped once - the guarded updateMany on
      // `firstTourLiveAt IS NULL` lets exactly one publish win, ever - and
      // the winner commits the `operator.first-tour-live` domain event in
      // the SAME transaction (B6 outbox rule: never enqueue what a rollback
      // could un-happen). WP-D consumes it for OB-5/OB-7/OB-8; until then
      // the relay logs-and-dispatches unknown types harmlessly.
      const stamped = await tx.operator.updateMany({
        where: { id: tour.operatorId, firstTourLiveAt: null },
        data: { firstTourLiveAt: now },
      });
      if (stamped.count === 1) {
        await tx.outboxEvent.create({
          data: {
            aggregate: 'operator',
            aggregateId: tour.operatorId,
            type: 'operator.first-tour-live',
            payload: { operatorId: tour.operatorId, tourId: id },
          },
        });
      }

      return row;
    });

    this.logger.log(
      `User ${userId} published tour ${id} (bookable=${bookable})`,
    );
    this.inbox.notify({
      event: InboxEvent.TOUR_PUBLISHED,
      operatorId: tour.operatorId,
      title: `${tour.name} is live`,
      body: bookable
        ? 'Travellers can book it now.'
        : 'It is published but not listed yet - it has no bookable departures in the next 30 days.',
      url: this.tourReviewPath(id),
      entityType: 'tour',
      entityId: id,
      actorUserId: userId,
      dedupeKey: `TOUR_PUBLISHED:${id}:${now.toISOString()}`,
    });
    return this.flattenTour(updated);
  }

  /**
   * Validates a hub can be attached to a tour with the given categories (inside a
   * transaction, TOCTOU-safe). A hub is valid when it exists, is active, belongs to
   * the tour's destination, AND shares at least one category with the tour's allowed
   * list. On failure it throws a message that names the hub and the exact category
   * mismatch (the tour's categories vs the hub's allowed categories) so the operator
   * knows precisely what to change - never a raw hub UUID.
   */
  private async assertHubAllowsCategories(
    tx: Prisma.TransactionClient,
    hubId: string,
    destinationId: string,
    categoryIds: string[],
  ): Promise<void> {
    const hub = await tx.hub.findUnique({
      where: { id: hubId },
      select: {
        id: true,
        name: true,
        destinationId: true,
        isActive: true,
        allowedCategories: {
          select: { category: { select: { id: true, name: true } } },
        },
      },
    });
    if (!hub || !hub.isActive) {
      throw new BadRequestException(`Hub ${hubId} not found or is not active`);
    }
    if (hub.destinationId !== destinationId) {
      throw new BadRequestException(
        `Hub "${hub.name}" belongs to a different destination and cannot be attached to this tour.`,
      );
    }
    const allowed = hub.allowedCategories.map((a) => a.category);
    const allowedIds = new Set(allowed.map((c) => c.id));
    if (!categoryIds.some((cid) => allowedIds.has(cid))) {
      const tourCatNames = (
        await tx.category.findMany({
          where: { id: { in: categoryIds } },
          select: { name: true },
        })
      ).map((c) => c.name);
      const allowedNames = allowed.map((c) => c.name);
      throw new BadRequestException(
        allowedNames.length
          ? `Hub "${hub.name}" only accepts tours in these categories: ${allowedNames.join(
              ', ',
            )}. This tour's categories (${tourCatNames.join(
              ', ',
            )}) don't match any of them. Add a matching category to the tour or remove this hub.`
          : `Hub "${hub.name}" has no allowed categories configured yet, so no tour can be attached to it. Ask an admin to set the hub's allowed categories first.`,
      );
    }
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
    // Defense in depth: PAUSED is only reachable from LIVE (which implies
    // APPROVED), but a future direct-write/repair path must not let unpause
    // resurrect a tour that never cleared review. Same admin bypass as
    // publish (an admin bringing it live IS the review).
    if (
      userRole !== Role.ADMIN &&
      tour.approvalStatus !== TourApprovalStatus.APPROVED
    ) {
      throw new ConflictException(
        'Tour must be approved before going live (submit it for review first)',
      );
    }

    // Re-derive bookability on resume (availability may have changed while paused).
    const bookable = await this.availability.computeIsBookable(id);
    const updated = await this.prisma.tour.update({
      where: { id },
      data: {
        status: TourStatus.LIVE,
        isBookable: bookable,
        approvalStatus: TourApprovalStatus.APPROVED,
      },
      select: this.tourSelect,
    });

    this.logger.log(
      `User ${userId} unpaused tour ${id} (bookable=${bookable})`,
    );
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
        // A restored tour re-enters the pipeline from scratch: whatever was
        // approved before archiving may be edited before it goes live again,
        // so the old approval must not carry over (and a stale APPROVED
        // would dead-end submitForReview with a 409).
        data: {
          status: TourStatus.DRAFT,
          isActive: true,
          approvalStatus: TourApprovalStatus.NOT_SUBMITTED,
          submittedAt: null,
          reviewNote: null,
        },
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

    // Bookings and reviews are the two Tour relations WITHOUT onDelete:
    // Cascade, on purpose: a booking carries the commission snapshot, payment
    // and settlement history, a review carries the operator's reputation
    // record - neither may vanish because the listing does. Without this
    // check the delete reaches Postgres, trips over bookings_tourId_fkey and
    // surfaces as a bare 500 (admin force-delete included). Refuse with the
    // reason instead: archiving hides the tour everywhere and keeps history.
    const [bookings, reviews] = await Promise.all([
      this.prisma.booking.count({ where: { tourId: id } }),
      this.prisma.review.count({ where: { tourId: id } }),
    ]);
    if (bookings > 0 || reviews > 0) {
      const held = [
        bookings > 0 ? `${bookings} booking${bookings === 1 ? '' : 's'}` : null,
        reviews > 0 ? `${reviews} review${reviews === 1 ? '' : 's'}` : null,
      ]
        .filter(Boolean)
        .join(' and ');
      throw new ConflictException(
        `This tour cannot be permanently deleted: it has ${held}. ` +
          'Booking and review history are permanent records - archive the tour instead ' +
          '(it disappears from every listing and its slug is protected).',
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

  // ── Editorial: Locals' favourite (MANAGE_EDITORIAL, admin-only) ────────────────
  // Manual editorial flag per master §field-table: never operator-set, never
  // tier-linked, curated toward ~30% catalog coverage. Toggled only here — the
  // operator tour-update path cannot write isLocalsFavourite.

  async setLocalsFavourite(id: string, value: boolean, adminId: string) {
    const tour = await this.findTourOrThrow(id);
    // Only LIVE tours surface on the public "Locals' favourites" grid, so block
    // flagging a non-live tour (avoids a "flagged but not showing" surprise).
    // Un-flagging is always allowed, so a flag survives a later pause/archive.
    if (value && tour.status !== TourStatus.LIVE) {
      throw new BadRequestException(
        'Only live tours can be marked as a Locals’ favourite',
      );
    }
    const updated = await this.prisma.tour.update({
      where: { id },
      data: { isLocalsFavourite: value },
      select: { id: true, isLocalsFavourite: true },
    });
    this.logger.log(
      `Admin ${adminId} set isLocalsFavourite=${value} on tour ${id}`,
    );
    return updated;
  }

  /**
   * Coverage stats for the Locals' favourite editorial surface. Denominator is
   * LIVE tours (what travelers actually see); `target` is the master's ~30%.
   */
  async getLocalsFavouriteStats() {
    const [liveByDest, flaggedByDest, destinations] = await Promise.all([
      this.prisma.tour.groupBy({
        by: ['destinationId'],
        where: { status: TourStatus.LIVE },
        _count: { _all: true },
      }),
      this.prisma.tour.groupBy({
        by: ['destinationId'],
        where: { status: TourStatus.LIVE, isLocalsFavourite: true },
        _count: { _all: true },
      }),
      this.prisma.destination.findMany({ select: { id: true, name: true } }),
    ]);

    const liveMap = new Map(
      liveByDest.map((r) => [r.destinationId, r._count._all]),
    );
    const flaggedMap = new Map(
      flaggedByDest.map((r) => [r.destinationId, r._count._all]),
    );
    const nameMap = new Map(destinations.map((d) => [d.id, d.name]));

    const pct = (flagged: number, total: number) =>
      total === 0 ? 0 : Math.round((flagged / total) * 100);

    const perDestination = [...liveMap.entries()]
      .map(([destinationId, totalLive]) => {
        const flagged = flaggedMap.get(destinationId) ?? 0;
        return {
          destinationId,
          destinationName: nameMap.get(destinationId) ?? destinationId,
          totalLive,
          flagged,
          pct: pct(flagged, totalLive),
        };
      })
      .sort((a, b) => a.destinationName.localeCompare(b.destinationName));

    const totalLive = [...liveMap.values()].reduce((s, n) => s + n, 0);
    const flagged = [...flaggedMap.values()].reduce((s, n) => s + n, 0);

    return {
      totalLive,
      flagged,
      pct: pct(flagged, totalLive),
      target: 30,
      perDestination,
    };
  }
}
