import { HubTripsPanelSkeleton } from '@/components/frontend/skeletons/hub-trips-panel-skeleton';
import {
    getDestinationBySlug,
    getDestinationCategories,
    getDestinationTours,
    getHubRender,
} from '@/lib/api/public';
import {
    isCurrency,
    localizeHref,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import {
    deriveDisplayRate,
    formatPriceFrom,
    resolveDisplayPrice,
} from '@/lib/currency/current';
import { getServerCurrency } from '@/lib/currency/server';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import {
    priceUnitLabel,
    type PriceUnitLabels,
} from '@/lib/tours/pricing-label';
import type {
    HubRender,
    HubRenderComparisonGroup,
    HubRenderOurPick,
    HubRenderSection,
} from '@/types/hub';
import type { SearchHit } from '@/types/search';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { FaqSection } from '../faq-section';
import { ToursBreadcrumb } from '../tours/tours-breadcrumb';
import {
    HubAlsoWorthSection,
    type HubAlsoWorthItem,
} from './hub-also-worth-section';
import { HubCompareSection, type CompareTable } from './hub-compare-section';
import { HubDateProvider } from './hub-date-context';
import {
    HubDiscoverSection,
    type HubDiscoverItem,
} from './hub-discover-section';
import {
    HubFirstTimersSection,
    type HubFirstTimersTip,
} from './hub-first-timers-section';
import { HubHero, type HubHeroMeta } from './hub-hero';
import { type HubPick, type HubPickLabel } from './hub-pick-card';
import { type HubTour, type HubTourBadge } from './hub-tour-card';
import { HubTripsSection } from './hub-trips-section';
import { HubWhySection } from './hub-why-section';

/**
 * Activity Hub page - the HUB branch of the polymorphic `[slug]` route
 * (`/{locale}/{destination}/{activity-hub}/`). Master 5.5.
 *
 * Fully backed by the published-only `GET /hubs/render/:slug` aggregate (hero +
 * fast facts + editorial lead + Our Picks + comparison + Discover + Local Tips +
 * FAQs) plus a hub-filtered `GET /tours?hubId=` listing for the
 * trips grid / private charters split (master 8215/11667: `pricing_model = unit`
 * tours are the private charters; `per_person` are the shared trips). A hub only
 * renders when PUBLISHED + active (render returns null otherwise -> notFound()).
 *
 * PPR: the cached render feeds a prerendered shell; the tours-dependent trips
 * section streams inside a Suspense boundary with a mirroring skeleton (same
 * pattern as the category page).
 */

// ── Mappers: render/listing payload -> presentational card shapes ──────────────

/** Localized labels for the tour-card chip row + charter price line. */
type CardLabels = {
    day: string;
    /** Plural template, e.g. "{count} days". */
    days: string;
    /** Capacity chip template, e.g. "Up to {count}". */
    upTo: string;
    familyFriendly: string;
    amenities: Record<AmenityLabelKey, string>;
    /** Per-person price unit, e.g. "/per". */
    perPerson: string;
    /** Per-unit_type price nouns (e.g. "/per boat"). */
    perGroup: string;
    perBoat: string;
    perVehicle: string;
    perAircraft: string;
    perPackage: string;
    /** UNIT surcharge template, e.g. "+ {price} per extra person". */
    perExtra: string;
};

type AmenityLabelKey =
    | 'openBar'
    | 'bbq'
    | 'beachHouse'
    | 'breakfast'
    | 'meals'
    | 'drinks'
    | 'snorkeling';

/**
 * Amenity attribute key -> label key, in card display priority (Figma favours
 * beach house / BBQ / breakfast). Capped at MAX_AMENITY_CHIPS on the card.
 */
const AMENITY_CHIPS: [attributeKey: string, label: AmenityLabelKey][] = [
    ['beach_house_included', 'beachHouse'],
    ['bbq_included', 'bbq'],
    ['breakfast_included', 'breakfast'],
    ['open_bar_included', 'openBar'],
    ['food_included', 'meals'],
    ['drinks_included', 'drinks'],
    ['snorkeling_included', 'snorkeling'],
];
const MAX_AMENITY_CHIPS = 2;

/** Reverse lookup (attribute key -> amenity label key) for the hero pill. */
const AMENITY_LABEL_KEY_BY_ATTR = new Map<string, AmenityLabelKey>(
    AMENITY_CHIPS.map(([attr, label]) => [attr, label])
);

/**
 * Minutes -> duration chip (Figma cards read raw hours, distinct from the hero
 * pill's "Full day (8-9h)"). Under 1h reads minutes, 1-23h hours ("8h"), 24h+
 * days ("2 days"). Blank when unset.
 */
function formatDuration(
    from: number | null | undefined,
    labels: Pick<CardLabels, 'day' | 'days'>
): string {
    if (from == null) return '';
    if (from >= 1440) {
        const d = Math.round(from / 1440);
        return d <= 1 ? labels.day : labels.days.replace('{count}', String(d));
    }
    if (from >= 60) return `${Math.round(from / 60)}h`;
    return `${from}m`;
}

/** Enum attribute value -> display label ("glass_bottom" -> "Glass bottom"). */
function titleCaseValue(v: string): string {
    const spaced = v.replace(/_/g, ' ').trim();
    return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : '';
}

/**
 * Builds the card's dot-separated attribute chips from the listing hit:
 * duration, then capacity ("Up to N") for charters, boat type, up to 3 true
 * amenities, and the family-friendly flag - all derived from data the operator
 * already enters (attributes + flags).
 */
function buildCardChips(hit: SearchHit, labels: CardLabels): string[] {
    const chips: string[] = [];
    const duration = formatDuration(hit.durationMinutesFrom, labels);
    if (duration) chips.push(duration);

    if (hit.pricingModel === 'UNIT' && hit.maxPartySize != null) {
        chips.push(labels.upTo.replace('{count}', String(hit.maxPartySize)));
    }

    const attrs = new Map((hit.attributes ?? []).map(a => [a.key, a]));
    const boat = attrs.get('boat_type');
    if (boat?.value) chips.push(titleCaseValue(boat.value));

    let added = 0;
    for (const [key, labelKey] of AMENITY_CHIPS) {
        if (added >= MAX_AMENITY_CHIPS) break;
        if (attrs.get(key)?.value === 'true') {
            chips.push(labels.amenities[labelKey]);
            added++;
        }
    }

    if (hit.familyFriendly) chips.push(labels.familyFriendly);
    return chips;
}

/**
 * Card price display for a listing hit. PER_PERSON keeps the "per person" suffix;
 * UNIT (charter) reads "from $X /N people + $Y per extra person" from the
 * unit-pricing fields.
 */
function cardPrice(
    hit: SearchHit,
    labels: CardLabels,
    locale: Locale
): { priceDisplay: string; priceUnit: string; priceNote?: string } {
    // Same money-resolution rule as every other card surface (guide §20.9).
    const { currency, priceDisplay, fxRate } = resolveDisplayPrice(hit, locale);
    if (hit.pricingModel !== 'UNIT') {
        return { priceDisplay, priceUnit: labels.perPerson };
    }
    // Unit-type-aware noun ("/per boat" etc.). The per-extra-guest note only
    // shows for GROUP pricing (non-GROUP charters carry no extraPersonPrice).
    const priceUnit = priceUnitLabel(
        { pricingModel: hit.pricingModel, wholeUnitType: hit.wholeUnitType },
        {
            per: labels.perPerson,
            perGroup: labels.perGroup,
            perBoat: labels.perBoat,
            perVehicle: labels.perVehicle,
            perAircraft: labels.perAircraft,
            perPackage: labels.perPackage,
        }
    );
    // `extraPersonPrice` is a source-currency amount (not in `money`), so convert
    // it with the same rate before formatting.
    const extra = Number(hit.extraPersonPrice ?? 0);
    const priceNote =
        extra > 0
            ? labels.perExtra.replace(
                  '{price}',
                  formatPriceFrom(extra * fxRate, currency, locale)
              )
            : undefined;
    return { priceDisplay, priceUnit, priceNote };
}

/** A whole-unit charter is "overnight" when it spans a full day or more (multi-day). */
const OVERNIGHT_MIN_MINUTES = 1440;
function isOvernightHit(hit: SearchHit): boolean {
    return (hit.durationMinutesFrom ?? 0) >= OVERNIGHT_MIN_MINUTES;
}

// The 4 hero meta-pill icons (Figma 48024:11162), in render order.
const HERO_ICON = {
    duration: '/icons/hub/meta-duration.svg',
    price: '/icons/hub/meta-price.svg',
    inclusion: '/icons/hub/meta-inclusion.svg',
    frequency: '/icons/hub/meta-frequency.svg',
} as const;

/** One minute count -> "8h" / "1.5h" / "90m" (whole hours drop the decimal). */
function minutesShort(m: number): string {
    if (m < 60) return `${m}m`;
    const h = m / 60;
    return `${Number.isInteger(h) ? h : h.toFixed(1)}h`;
}

/** Duration range for the hero pill: "8-9h" (same unit) / "8h" (single). */
function heroDurationLabel(from: number | null, to: number | null): string {
    if (from == null) return '';
    if (to == null || to === from) return minutesShort(from);
    // Both whole hours -> compact "8-9h"; otherwise show both fully.
    if (from % 60 === 0 && to % 60 === 0) return `${from / 60}-${to / 60}h`;
    return `${minutesShort(from)} - ${minutesShort(to)}`;
}

/** Uppercase the first character only ("from" -> "From"); locale-safe no-op on CJK. */
function capitalizeFirst(s: string): string {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Headings/bodies that mark a fast fact as the meal/inclusion pill (Figma shows
// the food name, e.g. "BBQ lunch"). Matched case-insensitively.
const MEAL_KEYWORDS = [
    'lunch',
    'meal',
    'food',
    'breakfast',
    'brunch',
    'dinner',
    'bbq',
    'snack',
    'dining',
    'tapas',
    'drinks',
    'refreshment',
];

/**
 * The food/inclusion pill is editorial (a meal name isn't derivable from tour
 * data), so pick it from the hub's fast facts: find the meal-related fact, use
 * its body, and strip a trailing "included" so "BBQ lunch included" -> "BBQ
 * lunch". Returns '' when the hub has no meal fact (pill is then dropped).
 */
function pickMealLabel(fastFacts: { heading: string; body: string }[]): string {
    const hit = fastFacts.find(f => {
        const text = `${f.heading} ${f.body}`.toLowerCase();
        return MEAL_KEYWORDS.some(k => text.includes(k));
    });
    if (!hit) return '';
    const raw = (hit.body || hit.heading || '').trim();
    const cleaned = raw.replace(/\s*(is\s+)?incl(uded|\.)?$/i, '').trim();
    return capitalizeFirst(cleaned);
}

/** ENUM value -> Title Case ("BOAT" -> "Boat"); '' when unset. */
function humanizeUnit(u: string | null | undefined): string {
    if (!u) return '';
    return u.charAt(0) + u.slice(1).toLowerCase();
}

/** SearchHit badge -> hub-card badge ('new' has no hub-card slot -> null). */
function toHubBadge(b: SearchHit['badge']): HubTourBadge {
    return b === 'sponsored' || b === 'mostPopular' || b === 'likelyToSellOut'
        ? b
        : null;
}

const PICK_LABEL_BY_TYPE: Record<string, HubPickLabel> = {
    BEST_OVERALL: 'best',
    MOST_POPULAR: 'popular',
    BEST_FOR_FAMILIES: 'families',
    BEST_VALUE: 'best',
};

function hitToHubTour(
    hit: SearchHit,
    locale: Locale,
    destinationSlug: string,
    labels: CardLabels
): HubTour {
    const { priceDisplay, priceUnit, priceNote } = cardPrice(hit, labels, locale);
    return {
        id: hit.id,
        href: localizeHref(locale, `/${destinationSlug}/${hit.slug}`),
        images: (hit.images ?? []).map(img => img.url).filter(Boolean),
        badge: toHubBadge(hit.badge),
        rating: hit.aggregateRating ?? 0,
        reviewCount: hit.aggregateReviewCount,
        title: hit.title,
        attributes: buildCardChips(hit, labels),
        priceDisplay,
        priceUnit,
        priceNote,
        freeCancellation: hit.cancellationHours != null,
    };
}

function pickToHubPick(
    pick: HubRenderOurPick,
    labelText: Record<HubPickLabel, string>,
    durationLabels: Pick<CardLabels, 'day' | 'days'>,
    priceUnitLabels: PriceUnitLabels,
    tourHref: (slug: string) => string,
    locale: Locale,
    currency: Currency
): HubPick {
    const label = PICK_LABEL_BY_TYPE[pick.pickType] ?? 'best';
    return {
        id: pick.id,
        href: tourHref(pick.tour.slug),
        label,
        labelText: labelText[label],
        title: pick.tour.title,
        rating: pick.tour.rating ?? 0,
        reviewCount: pick.tour.reviewCount ?? 0,
        // Figma shows the boat type under the title; fall back to the unit type
        // (e.g. "Private charter") for non-boat picks that carry no boat_type.
        type: pick.tour.boatType
            ? titleCaseValue(pick.tour.boatType)
            : humanizeUnit(pick.tour.unitType),
        description: pick.description,
        duration: formatDuration(pick.tour.durationMinutesFrom, durationLabels),
        priceDisplay: resolveDisplayPrice(pick.tour, locale, currency).priceDisplay,
        priceUnit: priceUnitLabel(
            {
                pricingModel: pick.tour.pricingModel,
                wholeUnitType: pick.tour.unitType,
            },
            priceUnitLabels
        ),
        images: (pick.tour.images ?? []).map(img => img.url).filter(Boolean),
    };
}

function groupToCompareTable(
    group: HubRenderComparisonGroup,
    whatStandsOutLabel: string,
    priceUnitLabels: PriceUnitLabels,
    tourHref: (slug: string) => string,
    locale: Locale,
    currency: Currency
): CompareTable {
    // Editorial lead row: each column's standout note, split on commas into
    // bullet-joined fragments (e.g. "Dive school, massage with a view").
    const standoutRow = {
        label: whatStandsOutLabel,
        cells: group.tours.map(ct => ({
            parts: (ct.standoutNote ?? '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean),
            check: undefined,
        })),
    };
    const hasStandout = standoutRow.cells.some(c => c.parts.length > 0);

    return {
        title: group.groupName,
        boats: group.tours.map(ct => ({
            name: ct.tour.title,
            priceDisplay: resolveDisplayPrice(ct.tour, locale, currency)
                .priceDisplay,
            priceUnit: priceUnitLabel(
                {
                    pricingModel: ct.tour.pricingModel,
                    wholeUnitType: ct.tour.unitType,
                },
                priceUnitLabels
            ),
            href: tourHref(ct.tour.slug),
        })),
        // "What stands out" (editorial, from standoutNote) sits above the curated
        // attribute rows (backend template). A BOOLEAN true renders a green check;
        // everything else renders its parts.
        rows: [
            ...(hasStandout ? [standoutRow] : []),
            ...group.rows.map(r => ({
                label: r.label,
                cells: r.cells.map(c => ({
                    parts: c.parts,
                    check: c.check === true ? true : undefined,
                })),
            })),
        ],
    };
}

function sectionToDiscoverItem(s: HubRenderSection): HubDiscoverItem {
    return { title: s.heading, body: s.body, image: s.image };
}

function sectionToTip(s: HubRenderSection): HubFirstTimersTip {
    return { title: s.heading, body: s.body };
}

interface HubPageProps {
    /** Destination slug from the URL (e.g. `curacao`). */
    destinationSlug: string;
    /** Resolved hub slug from the URL (e.g. `klein-curacao`). */
    hubSlug: string;
    /** Hub id from the slug-registry resolution (`entityId`). */
    hubId: string;
    /** Proper-noun destination display name (resolved by the route). */
    destinationName: string;
    locale: Locale;
    dict: Dictionary;
}

export async function HubPage({
    destinationSlug,
    hubSlug,
    destinationName,
    locale,
    dict,
}: HubPageProps) {
    // Resolve the shopper currency + destination UUID in parallel (independent),
    // then fetch the published-only render aggregate for that currency so every
    // hub price (trips, our-picks, comparison, hero) is converted (guide §20.9).
    const [currency, destination] = await Promise.all([
        getServerCurrency(locale),
        getDestinationBySlug(destinationSlug, locale),
    ]);
    if (!destination) notFound();

    const render = await getHubRender(
        hubSlug,
        destination.id,
        locale,
        currency
    );
    if (!render) notFound();

    // "Also worth your time on {destination}" links to the destination's own
    // activity categories (tour-gated, top 3), not sibling hubs (master 5.5 /
    // Figma 48024:12096). Cached alongside the render, so the shell stays static.
    const categories = await getDestinationCategories(destinationSlug, locale);

    const hubDict = dict.destination.hub;
    const listingsDict = dict.destination.listings;
    const breadcrumbLabel = render.breadcrumbLabel ?? render.name;

    // Hero meta pills - the 4 Figma pills (48024:11162):
    //   "Full day (8-9h)" · "From $120" · "BBQ lunch" · "Daily"
    // Duration / price / frequency are computed by the backend from the hub's
    // LIVE tour set (`render.hero.stats`); the meal name is editorial, read from
    // the hub's fast facts. A pill is dropped when its source is absent, so the
    // row never pads out.
    const stats = render.hero.stats;
    const heroMeta: HubHeroMeta[] = [];

    // `hero.stats.priceFrom` is a source-currency aggregate the backend does not
    // convert (guide §20.9 defers hub aggregates). Derive the shopper-currency
    // rate from the render's converted cards (shared helper) and convert it.
    const { currency: heroCurrency, rate: heroRate } = deriveDisplayRate(
        [
            ...render.ourPicks.map(p => p.tour),
            ...render.comparisonGroups.flatMap(g => g.tours.map(t => t.tour)),
        ],
        currency
    );

    // 1. Duration - qualitative day-part + computed range: "Full day (8-9h)".
    const durationRange = heroDurationLabel(
        stats.durationMinutesFrom,
        stats.durationMinutesTo
    );
    if (durationRange) {
        const from = stats.durationMinutesFrom ?? 0;
        const dayPart =
            from >= 300
                ? hubDict.durationFullDay
                : from >= 120
                  ? hubDict.durationHalfDay
                  : '';
        heroMeta.push({
            icon: HERO_ICON.duration,
            label: dayPart ? `${dayPart} (${durationRange})` : durationRange,
        });
    }

    // 2. Price - capitalized "From <price>" in the shopper's currency.
    if (stats.priceFrom != null)
        heroMeta.push({
            icon: HERO_ICON.price,
            label: `${capitalizeFirst(listingsDict.from)} ${formatPriceFrom(
                stats.priceFrom * heroRate,
                heroCurrency,
                locale
            )}`,
        });

    // 3. Inclusion - the hub's headline amenity ("BBQ lunch"), picked by the
    //    backend from the tours' tour_attributes (BBQ first). Uses the more
    //    descriptive hero label (not the terse card chip), and falls back to the
    //    editorial fast-fact meal name when no amenity attribute applies.
    const inclusionKey = stats.inclusion
        ? AMENITY_LABEL_KEY_BY_ATTR.get(stats.inclusion)
        : undefined;
    const heroInclusion: Record<string, string> = hubDict.heroInclusion ?? {};
    const inclusionLabel =
        (inclusionKey && heroInclusion[inclusionKey]) ||
        pickMealLabel(render.hero.fastFacts);
    if (inclusionLabel)
        heroMeta.push({ icon: HERO_ICON.inclusion, label: inclusionLabel });

    // 4. Frequency - "Daily" when the hub runs all week, else "N days a week".
    if (stats.frequencyDays > 0)
        heroMeta.push({
            icon: HERO_ICON.frequency,
            label:
                stats.frequencyDays >= 7
                    ? hubDict.frequencyDaily
                    : hubDict.frequencyWeekly.replace(
                          '{count}',
                          String(stats.frequencyDays)
                      ),
        });

    // Editorial lead ("Why {hub}" / "Our {hub}") - authored overview split on
    // blank lines. Rendered only when authored.
    const whyTitle = hubDict.whyTitle.replace('{hub}', render.name);
    const whyParagraphs = render.editorialLead?.trim()
        ? render.editorialLead
              .split(/\n{2,}/)
              .map(p => p.trim())
              .filter(Boolean)
        : [];

    // FAQs from the backend; fall back to the localized placeholder set until a
    // hub has authored FAQs.
    const faqItems =
        render.faqs.length > 0
            ? render.faqs.map(f => ({ q: f.question, a: f.answer }))
            : hubDict.faq.items;
    const faqDict = {
        ...dict.home.faq,
        title: dict.destination.faqTitle,
        items: faqItems,
    };

    // Destination categories -> "Also worth your time" cards, each linking to
    // the category's flat URL. Categories the hub already covers (its allowed
    // categories, e.g. boat-tours / snorkeling / day-trips) are excluded so the
    // grid only surfaces something new; top 3 of the remainder.
    const hubCategorySlugs = new Set(render.allowedCategorySlugs);
    const alsoWorthItems: HubAlsoWorthItem[] = categories
        .filter(c => !hubCategorySlugs.has(c.slug))
        .slice(0, 3)
        .map(c => ({ name: c.name, slug: c.slug, image: c.heroImage ?? undefined }));
    const alsoWorthTitle = hubDict.alsoWorthTitle.replace(
        '{destination}',
        destinationName
    );

    const firstTimersTitle = hubDict.firstTimersTitle.replace(
        '{hub}',
        render.name
    );

    return (
        <HubDateProvider>
            <ToursBreadcrumb
                locale={locale}
                destinationName={destinationName}
                destinationSlug={destinationSlug}
                dict={{
                    home: dict.destination.allTours.breadcrumb.home,
                    current: breadcrumbLabel,
                }}
            />
            <HubHero
                title={render.hero.h1}
                tagline={render.hero.heroTagline}
                image={render.hero.heroImage}
                meta={heroMeta}
                dict={{
                    tagline: hubDict.tagline,
                    selectDate: hubDict.selectDate,
                    checkAvailability: hubDict.checkAvailability,
                }}
            />
            {whyParagraphs.length > 0 && (
                <HubWhySection
                    title={whyTitle}
                    paragraphs={whyParagraphs}
                    learnMoreLabel={dict.destination.about.learnMore}
                    readLessLabel={dict.destination.about.readLess}
                />
            )}

            {/* Trips + charters split is the only tours-dependent block: stream it
                with a mirroring skeleton (compare/discover panels inside reuse the
                already-cached render, passed through). */}
            <Suspense fallback={<HubTripsPanelSkeleton />}>
                <HubTripsData
                    render={render}
                    destinationId={destination.id}
                    destinationSlug={destinationSlug}
                    locale={locale}
                    dict={dict}
                />
            </Suspense>

            <HubFirstTimersSection
                dict={{
                    title: firstTimersTitle,
                    highlights: render.highlights,
                    tips: render.localTips.map(sectionToTip),
                }}
            />
            <FaqSection dict={faqDict} minimal />
            <HubAlsoWorthSection
                title={alsoWorthTitle}
                items={alsoWorthItems}
                locale={locale}
                destinationSlug={destinationSlug}
            />
        </HubDateProvider>
    );
}

/**
 * Streamed trips/charters block. Fetches the hub-filtered tour listing and
 * partitions it by pricing model (master 8215/11667): `per_person` -> shared
 * trips grid, `unit` -> private charters. Compare + Discover panels come from the
 * already-resolved render payload (passed in), so this makes exactly one fetch.
 */
async function HubTripsData({
    render,
    destinationId,
    destinationSlug,
    locale,
    dict,
}: {
    render: HubRender;
    destinationId: string;
    destinationSlug: string;
    locale: Locale;
    dict: Dictionary;
}) {
    // Force this into a request-time dynamic hole so the cached hub shell ships
    // first and the trips/charters block streams behind its skeleton. The hub
    // route is on-demand (not prerendered), and trips is a separate fetch from the
    // hub render, so shell-first streaming is the right call here (mirrors the
    // tour-detail page). The loader itself stays cached, so the stream is fast.
    await connection();
    const currency = await getServerCurrency(locale);
    const toursRes = await getDestinationTours({
        destinationId,
        hubId: render.id,
        locale,
        currency,
        limit: 60,
    });

    const hubDict = dict.destination.hub;
    const listingsDict = dict.destination.listings;
    const chartersDict = hubDict.charters;
    const picksDict = hubDict.picks;
    const discoverDict = hubDict.discover;

    const cardLabels: CardLabels = {
        day: hubDict.durationDay,
        days: hubDict.durationDays,
        upTo: hubDict.cardChips.upTo,
        familyFriendly: hubDict.cardChips.familyFriendly,
        amenities: hubDict.cardChips.amenities,
        perPerson: hubDict.cardChips.perUnit,
        perGroup: hubDict.cardChips.perGroup,
        perBoat: hubDict.cardChips.perBoat,
        perVehicle: hubDict.cardChips.perVehicle,
        perAircraft: hubDict.cardChips.perAircraft,
        perPackage: hubDict.cardChips.perPackage,
        perExtra: hubDict.cardChips.perExtraPerson,
    };

    // Price-unit labels for the pick + comparison cards (unit-type-aware).
    const priceUnitLabels: PriceUnitLabels = {
        per: cardLabels.perPerson,
        perGroup: cardLabels.perGroup,
        perBoat: cardLabels.perBoat,
        perVehicle: cardLabels.perVehicle,
        perAircraft: cardLabels.perAircraft,
        perPackage: cardLabels.perPackage,
    };

    const linkTour = (hit: SearchHit): HubTour =>
        hitToHubTour(hit, locale, destinationSlug, cardLabels);
    const tourHref = (slug: string) =>
        localizeHref(locale, `/${destinationSlug}/${slug}`);

    // Partition: whole-unit tours are the private charters; the rest are trips.
    const trips = toursRes.data
        .filter(t => t.pricingModel !== 'UNIT')
        .map(linkTour);
    const charterHits = toursRes.data.filter(t => t.pricingModel === 'UNIT');
    // Charters split into Day vs Overnight groups (Figma node 48024:11456).
    const dayCharterTours = charterHits
        .filter(h => !isOvernightHit(h))
        .map(linkTour);
    const overnightCharterTours = charterHits
        .filter(isOvernightHit)
        .map(linkTour);

    // Our Picks (editorial) -> the picks block appended to the charters panel.
    const pickLabelText = {
        best: picksDict.best,
        popular: picksDict.popular,
        families: picksDict.families,
    };
    const picks: HubPick[] = render.ourPicks.map(p =>
        pickToHubPick(
            p,
            pickLabelText,
            cardLabels,
            priceUnitLabels,
            tourHref,
            locale,
            currency
        )
    );

    const compareTables = render.comparisonGroups.map(g =>
        groupToCompareTable(
            g,
            hubDict.comparison.whatStandsOut,
            priceUnitLabels,
            tourHref,
            locale,
            currency
        )
    );
    const discoverItems = render.discover.map(sectionToDiscoverItem);
    const discoverTitle = discoverDict.titlePattern.replace(
        '{hub}',
        render.name
    );

    const tripsTitle = hubDict.tripsHeading
        .replace('{count}', String(trips.length))
        .replace('{hub}', render.name);

    // Day / Overnight charter groups, each labelled with its count (Figma
    // "Day charters (N)" / "Overnight charters (M)"). Empty groups are dropped.
    const charterGroups = [
        { title: chartersDict.dayCharters, tours: dayCharterTours },
        { title: chartersDict.overnightCharters, tours: overnightCharterTours },
    ]
        .filter(g => g.tours.length > 0)
        .map(g => ({
            title: `${g.title} (${g.tours.length})`,
            tours: g.tours,
        }));

    const tripsTabs = [
        { key: 'trips', label: hubDict.tabs.trips },
        { key: 'private-charters', label: hubDict.tabs.privateCharters },
        { key: 'compare', label: hubDict.tabs.compare },
        { key: 'discover', label: hubDict.tabs.discover },
    ];

    const tripsPanels = [
        {
            title: tripsTitle,
            subtitle: hubDict.tripsSubtitle,
            groups: [{ tours: trips }],
        },
        {
            title: chartersDict.heading.replace(
                '{count}',
                String(charterHits.length)
            ),
            subtitle: chartersDict.subtitle,
            groups: charterGroups,
            picks: {
                title: picksDict.heading,
                subtitle: picksDict.subtitle,
                footerNote: picksDict.footerNote,
                seeAllLabel: picksDict.seeAllTours,
                seeAllHref: localizeHref(locale, `/${destinationSlug}/tours`),
                items: picks,
                card: {
                    from: listingsDict.from,
                    bookTrip: picksDict.bookTrip,
                    learnMore: dict.destination.about.learnMore,
                    readLess: dict.destination.about.readLess,
                },
            },
        },
        <HubCompareSection
            key='compare'
            tables={compareTables}
            dict={{
                title: hubDict.comparison.title,
                subtitle: hubDict.comparison.subtitle,
                from: listingsDict.from,
                book: hubDict.comparison.book,
            }}
        />,
        <HubDiscoverSection
            key='discover'
            items={discoverItems}
            bookTripTargetId='hub-section-trips'
            dict={{
                title: discoverTitle,
                // Per-hub editorial intro (dashboard) with the static string as fallback.
                subtitle: render.discoverIntro ?? discoverDict.subtitle,
                bookTrip: discoverDict.bookTrip,
                learnMore: dict.destination.about.learnMore,
                readLess: dict.destination.about.readLess,
            }}
        />,
    ];

    return (
        <HubTripsSection
            dict={{
                tabs: tripsTabs,
                panels: tripsPanels,
                selectDate: hubDict.selectDate,
                filter: {
                    checking: hubDict.checkingAvailability,
                    noneOnDate: hubDict.noneOnDate,
                    showAllDates: hubDict.showAllDates,
                },
                card: {
                    badges: {
                        sponsored: hubDict.sponsored,
                        mostPopular: listingsDict.mostPopular,
                        likelyToSellOut: listingsDict.likelyToSellOut,
                    },
                    from: listingsDict.from,
                    freeCancellation: listingsDict.freeCancellation,
                    save: dict.nav.wishlist,
                },
            }}
        />
    );
}

