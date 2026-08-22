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
import { getMediaSeo, normalizeUrl } from '@/lib/api/public/media';
import { getServerCurrency } from '@/lib/currency/server';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { buildBreadcrumbJsonLd } from '@/lib/seo/jsonld';
import { getSiteUrl } from '@/lib/seo/site-url';
import {
    priceUnitLabel,
    type PriceUnitLabels,
} from '@/lib/tours/pricing-label';
import {
    searchHitToListing,
    type DurationDict,
} from '@/lib/tours/listing';
import { hubCardTitle } from '@/lib/tours/tour-name';
import type {
    HubRender,
    HubRenderComparisonGroup,
    HubRenderOurPick,
    HubRenderSection,
} from '@/types/hub';
import type { SearchHit } from '@/types/search';
import { notFound } from 'next/navigation';
import { FaqSection } from '../faq-section';
import type { TourListing } from '../tour-card';
import { MountReveal } from '../mount-reveal';
import { JsonLd } from '../seo/json-ld';
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
 * Rendering: the whole page (shell + trips) resolves in ONE pass behind the
 * entity route's loading.tsx skeleton, then mounts with a single smooth fade.
 * The trips block deliberately has NO Suspense hole of its own - a second
 * skeleton after the entity skeleton read as a double-load, and the cached
 * listing resolved so fast the fallback just flashed.
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
 * beach house / BBQ / breakfast). Capped at MAX_AMENITY_CHIPS on the card - the
 * line has to survive a 282px column, and every amenity past the second pushes
 * it to a third row.
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
 * Backend-computed Day/Overnight charter verdict: the operator's "guests sleep
 * on board" flag OR duration >= 16h (`backend/src/tours/overnight.ts`). Served
 * on every listing hit so the rule is never mirrored here.
 */
function isOvernightHit(hit: SearchHit): boolean {
    return hit.isOvernight === true;
}

// The 4 hero meta-pill icons (Figma 48024:11162), in render order. The price
// icon follows the currency (mck-16): a euro glyph on euro amounts, the dollar
// glyph on dollar amounts - a dollar sign on "From €121" reads as a mistake.
const HERO_ICON = {
    duration: '/icons/hub/meta-duration.svg',
    price: '/icons/hub/meta-price.svg',
    priceEur: '/icons/hub/meta-price-eur.svg',
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
 * data), so pick it from the hub's fast facts: find the meal-related fact and
 * use its body as authored - "BBQ lunch included" stays whole (mck-16 restored
 * the full wording; this used to strip the trailing "included"). Returns ''
 * when the hub has no meal fact (pill is then dropped).
 */
function pickMealLabel(fastFacts: { heading: string; body: string }[]): string {
    const hit = fastFacts.find(f => {
        const text = `${f.heading} ${f.body}`.toLowerCase();
        return MEAL_KEYWORDS.some(k => text.includes(k));
    });
    if (!hit) return '';
    return capitalizeFirst((hit.body || hit.heading || '').trim());
}

/** ENUM value -> Title Case ("BOAT" -> "Boat"); '' when unset. */
function humanizeUnit(u: string | null | undefined): string {
    if (!u) return '';
    return u.charAt(0) + u.slice(1).toLowerCase();
}

/** SearchHit badge -> hub-card badge ('new' has no hub-card slot -> null). */
/**
 * The hub card's attribute line: duration, capacity, boat type, up to two
 * amenities, then family-friendly - in that order, rendered dot-separated by
 * `TourCard`.
 *
 * This is the one piece of the old hub-local card that had no equivalent on
 * the shared card, so it moved onto `TourListing.attributes` rather than
 * dying with it. On a hub every tour is the same kind of thing, and this line
 * is what actually distinguishes two cards from each other.
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

const PICK_LABEL_BY_TYPE: Record<string, HubPickLabel> = {
    BEST_OVERALL: 'best',
    MOST_POPULAR: 'popular',
    BEST_FOR_FAMILIES: 'families',
    BEST_VALUE: 'best',
};

/**
 * Map a search hit to the SHARED `TourListing`, with the two things the hub
 * page does differently.
 *
 * The hub listing used to carry its own card type, its own badge enum, its own
 * price resolver and its own attribute chips. It now renders the same
 * `TourCard` as All Tours, search, the destination page and collections
 * (founder, 2026-08-18), so all of that is `searchHitToListing`'s job and the
 * hub-local copies are deleted.
 *
 * Two overrides survive, and both are deliberate:
 *
 * 1. `title` is COMPOSED "{Hub} {Title}" and `hub` is nulled, which suppresses
 *    the card's hub eyebrow (founder, Aug 6 2026 / mck-18 §2). The stored title
 *    is hub-free and this is the one surface that puts the hub back INTO the
 *    title - so the eyebrow would repeat, on every card, the single fact the
 *    whole page is already about.
 * 2. `href` is built from the page's own `destinationSlug`. The shared mapper
 *    reads `hit.destinationSlug` and returns an UNLINKED card when it is
 *    absent; the hub query does not guarantee that field, and a grid of dead
 *    cards is a worse failure than one redundant argument.
 *
 * The attribute line (duration · boat type · amenities · family-friendly) is
 * NOT lost - it moved onto `TourListing.attributes` and the shared card renders
 * it, because it is the only thing telling two cards on a hub page apart.
 *
 * Deliberately dropped: the per-extra-person price note. No other card surface
 * carries one.
 */
function hitToHubListing(
    hit: SearchHit,
    locale: Locale,
    destinationSlug: string,
    duration: DurationDict,
    labels: CardLabels,
    hubName: string
): TourListing {
    return {
        ...searchHitToListing(hit, locale, duration),
        href: localizeHref(locale, `/${destinationSlug}/${hit.slug}`),
        title: hubCardTitle(hubName, hit.title),
        hub: null,
        attributes: buildCardChips(hit, labels),
    };
}

function pickToHubPick(
    pick: HubRenderOurPick,
    labelText: Record<HubPickLabel, string>,
    durationLabels: Pick<CardLabels, 'day' | 'days'>,
    priceUnitLabels: PriceUnitLabels,
    tourHref: (slug: string) => string,
    locale: Locale,
    currency: Currency,
    hubName: string
): HubPick {
    const label = PICK_LABEL_BY_TYPE[pick.pickType] ?? 'best';
    return {
        id: pick.id,
        href: tourHref(pick.tour.slug),
        label,
        labelText: labelText[label],
        // Same composed form as the trips grid (founder, Aug 6 2026).
        title: hubCardTitle(hubName, pick.tour.title),
        rating:
            (pick.tour.reviewCount ?? 0) > 0
                ? (pick.tour.rating ?? undefined)
                : undefined,
        reviewCount:
            (pick.tour.reviewCount ?? 0) > 0
                ? (pick.tour.reviewCount ?? undefined)
                : undefined,
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
    currency: Currency,
    hubName: string
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
            // Composed "{Hub} {Title}" like every hub-page card (mck-18 §2).
            name: hubCardTitle(hubName, ct.tour.title),
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
    const [currency, destination, siteUrl] = await Promise.all([
        getServerCurrency(locale),
        getDestinationBySlug(destinationSlug, locale),
        getSiteUrl(),
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
    //
    // The hero's localized alt text rides the same await: both depend only on the
    // render above, so serializing them would add a round-trip for nothing.
    const [categories, heroSeo] = await Promise.all([
        getDestinationCategories(destinationSlug, locale),
        getMediaSeo([render.hero.heroImage], locale),
    ]);

    const hubDict = dict.destination.hub;
    const listingsDict = dict.destination.listings;
    const breadcrumbLabel = render.breadcrumbLabel ?? render.name;

    const breadcrumbJsonLd = buildBreadcrumbJsonLd({
        siteUrl,
        locale,
        trail: [
            { name: destinationName, path: `/${destinationSlug}` },
            { name: breadcrumbLabel, path: `/${destinationSlug}/${hubSlug}` },
        ],
    });

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
    //
    // `converted` is load-bearing. Both sets it derives from are EDITORIAL and
    // optional - a hub with tours but no Our Picks and no comparison groups
    // yields no `money` at all, and `deriveDisplayRate` then answers with the
    // identity rate under the SHOPPER's currency. Printing that renders the
    // source number wearing the wrong symbol: a $120 tour reading "From €120"
    // to a EUR shopper, as the first price on the page, while the trips grid
    // further down shows the correctly converted figure. The page would
    // contradict itself.
    const {
        currency: heroCurrency,
        rate: heroRate,
        converted: heroConverted,
    } = deriveDisplayRate(
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

    // 2. Price - capitalized "From <price>" in the shopper's currency. Dropped
    //    entirely when no rate could be derived (see `heroConverted` above).
    //    A CONVERTED amount rounds UP to a whole figure (mck-16): the cents are
    //    FX noise, not a price - "From €121", never "From €120.50". Rounding up
    //    never understates. An unconverted aggregate (rate 1) stays the
    //    operator's exact price (founder rule: never round money for display).
    if (stats.priceFrom != null && heroConverted)
        heroMeta.push({
            icon:
                heroCurrency === 'EUR' ? HERO_ICON.priceEur : HERO_ICON.price,
            label: `${capitalizeFirst(listingsDict.from)} ${formatPriceFrom(
                heroRate === 1
                    ? stats.priceFrom
                    : Math.ceil(stats.priceFrom * heroRate),
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

    // FAQs from the backend; until a hub has authored its own, fall back to the
    // generic site-wide set. The bundled per-hub questions this used to fall
    // back to were written for one specific hub, so every other hub inherited
    // answers that were simply wrong.
    const faqItems =
        render.faqs.length > 0
            ? render.faqs.map(f => ({ q: f.question, a: f.answer }))
            : dict.home.faq.items;
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
            <JsonLd data={breadcrumbJsonLd} />
            {/* Pure fade (no lift - the hero's own MountReveal already lifts its
                heading) so the skeleton -> page swap is smooth, never a snap. */}
            <MountReveal yOffset={0} duration={0.4}>
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
                imageAlt={
                    render.hero.heroImage
                        ? heroSeo.get(normalizeUrl(render.hero.heroImage))
                              ?.altText
                        : null
                }
                meta={heroMeta}
                dict={{
                    tagline: hubDict.tagline,
                    selectDate: hubDict.selectDate,
                    clearDate: hubDict.clearDate,
                    checkAvailability: hubDict.checkAvailability,
                    share: hubDict.share,
                    linkCopied: hubDict.linkCopied,
                }}
            />
            {whyParagraphs.length > 0 && (
                <HubWhySection
                    title={whyTitle}
                    paragraphs={whyParagraphs}
                    readMoreLabel={hubDict.whyReadMore}
                    showLessLabel={hubDict.whyShowLess}
                />
            )}

            {/* Trips + charters render in the SAME pass as the shell (no Suspense
                hole): this route already sits behind the entity loading.tsx
                skeleton, and a second streamed skeleton here made the load read
                as "skeleton twice" + a flash when the cached listing resolved
                instantly. One cached fetch is not worth that.

                The sections below the trips block render as ITS children so
                they sit inside the tab bar's sticky scope - the bar stays stuck
                all the way down to the footer (they are not tabs; past Discover
                no tab is highlighted). */}
            <HubTripsData
                render={render}
                destinationId={destination.id}
                destinationSlug={destinationSlug}
                destinationName={destinationName}
                locale={locale}
                currency={currency}
                dict={dict}
            >
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
            </HubTripsData>
            </MountReveal>
        </HubDateProvider>
    );
}

/**
 * Trips/charters block (same render pass as the shell). Fetches the
 * hub-filtered tour listing and
 * partitions it by pricing model (master 8215/11667): `per_person` -> shared
 * trips grid, `unit` -> private charters. Compare + Discover panels come from the
 * already-resolved render payload (passed in), so this makes exactly one fetch.
 */
async function HubTripsData({
    render,
    destinationId,
    destinationSlug,
    destinationName,
    locale,
    currency,
    dict,
    children,
}: {
    render: HubRender;
    destinationId: string;
    destinationSlug: string;
    /** Proper-noun destination name for the Discover CTA band's fact line. */
    destinationName: string;
    locale: Locale;
    /** Shopper currency, already resolved by HubPage - no second await here. */
    currency: Currency;
    dict: Dictionary;
    /** Trailing page sections rendered inside the tab bar's sticky scope. */
    children?: React.ReactNode;
}) {
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

    const linkTour = (hit: SearchHit): TourListing =>
        hitToHubListing(
            hit,
            locale,
            destinationSlug,
            dict.search,
            cardLabels,
            render.name
        );
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
            currency,
            render.name
        )
    );

    const compareTables = render.comparisonGroups.map(g =>
        groupToCompareTable(
            g,
            hubDict.comparison.whatStandsOut,
            priceUnitLabels,
            tourHref,
            locale,
            currency,
            render.name
        )
    );
    const discoverItems = render.discover.map(sectionToDiscoverItem);
    const discoverTitle = discoverDict.titlePattern.replace(
        '{hub}',
        render.name
    );

    // Discover CTA band fact line (mck-16 §5): the number is BOUND to the same
    // count the trips grid renders - a hardcoded figure goes stale the first
    // time a boat is added. No per-person trips -> no honest number -> the
    // line drops (band keeps the claim + button).
    const discoverCtaFact =
        trips.length > 0
            ? discoverDict.cta.fact
                  .replace('{count}', String(trips.length))
                  .replace('{destination}', destinationName)
            : null;

    const tripsTitle = hubDict.tripsHeading
        .replace('{count}', String(trips.length))
        .replace('{hub}', render.name);

    // Day / Overnight charter groups, each labelled with its count ("Private
    // day charters (N)" / "Private overnight charters (M)"). Empty groups are
    // dropped.
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
                items: picks,
                card: {
                    from: listingsDict.from,
                    bookTrip: picksDict.bookTrip,
                    learnMore: dict.destination.about.learnMore,
                    readLess: dict.destination.about.readLess,
                    prevPhotoAria: listingsDict.prevPhotoAria,
                    nextPhotoAria: listingsDict.nextPhotoAria,
                    fullDetails: listingsDict.fullDetails,
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
                cta: {
                    title: discoverDict.cta.title,
                    fact: discoverCtaFact,
                    button: discoverDict.cta.button,
                },
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
                // `DestinationListingsDict` IS a `TourCardDict` superset, and
                // every field this used to spell out was already read off it.
                card: listingsDict,
            }}
        >
            {children}
        </HubTripsSection>
    );
}

