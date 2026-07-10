import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
    getDestinationBySlug,
    getDestinationCategories,
    getDestinationTours,
    getHubRender,
} from '@/lib/api/public';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type {
    HubRender,
    HubRenderComparisonGroup,
    HubRenderOurPick,
    HubRenderSection,
} from '@/types/hub';
import type { SearchHit } from '@/types/search';
import {
    HubAlsoWorthSection,
    type HubAlsoWorthItem,
} from './hub-also-worth-section';
import { HubCompareSection, type CompareTable } from './hub-compare-section';
import { FaqSection } from './faq-section';
import { HubDiscoverSection, type HubDiscoverItem } from './hub-discover-section';
import {
    HubFirstTimersSection,
    type HubFirstTimersTip,
} from './hub-first-timers-section';
import { HubDateProvider } from './hub-date-context';
import { HubHero, type HubHeroMeta } from './hub-hero';
import { type HubPick, type HubPickLabel } from './hub-pick-card';
import { type HubTour, type HubTourBadge } from './hub-tour-card';
import { HubTripsSection } from './hub-trips-section';
import { HubWhySection } from './hub-why-section';
import { ToursBreadcrumb } from './tours-breadcrumb';

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

// Fallback card image (used when a category has no heroImage yet).
const RELATED_FALLBACK_IMAGE = '/images/home-page/islands/curacao.jpg';

// ── Mappers: render/listing payload -> presentational card shapes ──────────────

function num(v: number | string | null | undefined): number {
    return Number(v ?? 0) || 0;
}

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
    /** UNIT included-guests template, e.g. "/{count} people". */
    peopleIncluded: string;
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
    AMENITY_CHIPS.map(([attr, label]) => [attr, label]),
);

/**
 * Minutes -> duration chip (Figma cards read raw hours, distinct from the hero
 * pill's "Full day (8-9h)"). Under 1h reads minutes, 1-23h hours ("8h"), 24h+
 * days ("2 days"). Blank when unset.
 */
function formatDuration(
    from: number | null | undefined,
    labels: Pick<CardLabels, 'day' | 'days'>,
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

    const attrs = new Map((hit.attributes ?? []).map((a) => [a.key, a]));
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
): { price: number; priceUnit: string; priceNote?: string } {
    const price = num(hit.priceFrom ?? hit.basePrice);
    if (hit.pricingModel !== 'UNIT') {
        return { price, priceUnit: labels.perPerson };
    }
    const priceUnit =
        hit.unitIncludedGuests != null
            ? labels.peopleIncluded.replace(
                  '{count}',
                  String(hit.unitIncludedGuests),
              )
            : '';
    const extra = Number(hit.extraPersonPrice ?? 0);
    const priceNote =
        extra > 0
            ? labels.perExtra.replace('{price}', `$${extra.toLocaleString()}`)
            : undefined;
    return { price, priceUnit, priceNote };
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
function heroDurationLabel(
    from: number | null,
    to: number | null,
): string {
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
function pickMealLabel(
    fastFacts: { heading: string; body: string }[],
): string {
    const hit = fastFacts.find((f) => {
        const text = `${f.heading} ${f.body}`.toLowerCase();
        return MEAL_KEYWORDS.some((k) => text.includes(k));
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
    labels: CardLabels,
): HubTour {
    const { price, priceUnit, priceNote } = cardPrice(hit, labels);
    return {
        id: hit.id,
        href: localizeHref(locale, `/${destinationSlug}/${hit.slug}`),
        image: hit.images?.[0]?.url ?? null,
        badge: toHubBadge(hit.badge),
        rating: hit.aggregateRating ?? 0,
        reviewCount: hit.aggregateReviewCount,
        title: hit.title,
        attributes: buildCardChips(hit, labels),
        price,
        priceUnit,
        priceNote,
        freeCancellation: hit.cancellationHours != null,
    };
}

function pickToHubPick(
    pick: HubRenderOurPick,
    labelText: Record<HubPickLabel, string>,
    durationLabels: Pick<CardLabels, 'day' | 'days'>,
): HubPick {
    const label = PICK_LABEL_BY_TYPE[pick.pickType] ?? 'best';
    return {
        id: pick.id,
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
        price: num(pick.tour.priceFrom ?? pick.tour.basePrice),
        image: pick.tour.heroImage ?? null,
    };
}

function groupToCompareTable(
    group: HubRenderComparisonGroup,
    whatStandsOutLabel: string,
): CompareTable {
    // Editorial lead row: each column's standout note, split on commas into
    // bullet-joined fragments (e.g. "Dive school, massage with a view").
    const standoutRow = {
        label: whatStandsOutLabel,
        cells: group.tours.map((ct) => ({
            parts: (ct.standoutNote ?? '')
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            check: undefined,
        })),
    };
    const hasStandout = standoutRow.cells.some((c) => c.parts.length > 0);

    return {
        title: group.groupName,
        boats: group.tours.map((ct) => ({
            name: ct.tour.title,
            price: num(ct.tour.priceFrom ?? ct.tour.basePrice),
        })),
        // "What stands out" (editorial, from standoutNote) sits above the curated
        // attribute rows (backend template). A BOOLEAN true renders a green check;
        // everything else renders its parts.
        rows: [
            ...(hasStandout ? [standoutRow] : []),
            ...group.rows.map((r) => ({
                label: r.label,
                cells: r.cells.map((c) => ({
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
    // Resolve the destination UUID (render is scoped by it), then fetch the
    // published-only render aggregate. Both are `use cache` (prerenderable).
    const destination = await getDestinationBySlug(destinationSlug, locale);
    if (!destination) notFound();

    const render = await getHubRender(hubSlug, destination.id, locale);
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

    // 1. Duration - qualitative day-part + computed range: "Full day (8-9h)".
    const durationRange = heroDurationLabel(
        stats.durationMinutesFrom,
        stats.durationMinutesTo,
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

    // 2. Price - capitalized "From $120" ("$" matches the hub cards' convention).
    if (stats.priceFrom != null)
        heroMeta.push({
            icon: HERO_ICON.price,
            label: `${capitalizeFirst(listingsDict.from)} $${stats.priceFrom.toLocaleString()}`,
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
                          String(stats.frequencyDays),
                      ),
        });

    // Editorial lead ("Why {hub}" / "Our {hub}") - authored overview split on
    // blank lines. Rendered only when authored.
    const whyTitle = hubDict.whyTitle.replace('{hub}', render.name);
    const whyParagraphs = render.editorialLead?.trim()
        ? render.editorialLead
              .split(/\n{2,}/)
              .map((p) => p.trim())
              .filter(Boolean)
        : [];

    // FAQs from the backend; fall back to the localized placeholder set until a
    // hub has authored FAQs.
    const faqItems =
        render.faqs.length > 0
            ? render.faqs.map((f) => ({ q: f.question, a: f.answer }))
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
        .filter((c) => !hubCategorySlugs.has(c.slug))
        .slice(0, 3)
        .map((c) => ({
            name: c.name,
            slug: c.slug,
            image: c.heroImage ?? RELATED_FALLBACK_IMAGE,
        }));
    const alsoWorthTitle = hubDict.alsoWorthTitle.replace(
        '{destination}',
        destinationName,
    );

    const firstTimersTitle = hubDict.firstTimersTitle.replace(
        '{hub}',
        render.name,
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
            <Suspense fallback={<HubTripsSkeleton />}>
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
    const toursRes = await getDestinationTours({
        destinationId,
        hubId: render.id,
        locale,
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
        peopleIncluded: hubDict.cardChips.peopleIncluded,
        perExtra: hubDict.cardChips.perExtraPerson,
    };

    const linkTour = (hit: SearchHit): HubTour =>
        hitToHubTour(hit, locale, destinationSlug, cardLabels);

    // Partition: whole-unit tours are the private charters; the rest are trips.
    const trips = toursRes.data
        .filter((t) => t.pricingModel !== 'UNIT')
        .map(linkTour);
    const charterHits = toursRes.data.filter((t) => t.pricingModel === 'UNIT');
    // Charters split into Day vs Overnight groups (Figma node 48024:11456).
    const dayCharterTours = charterHits.filter((h) => !isOvernightHit(h)).map(linkTour);
    const overnightCharterTours = charterHits.filter(isOvernightHit).map(linkTour);

    // Our Picks (editorial) -> the picks block appended to the charters panel.
    const pickLabelText = {
        best: picksDict.best,
        popular: picksDict.popular,
        families: picksDict.families,
    };
    const picks: HubPick[] = render.ourPicks.map((p) =>
        pickToHubPick(p, pickLabelText, cardLabels),
    );

    const compareTables = render.comparisonGroups.map((g) =>
        groupToCompareTable(g, hubDict.comparison.whatStandsOut),
    );
    const discoverItems = render.discover.map(sectionToDiscoverItem);
    const discoverTitle = discoverDict.titlePattern.replace(
        '{hub}',
        render.name,
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
        .filter((g) => g.tours.length > 0)
        .map((g) => ({ title: `${g.title} (${g.tours.length})`, tours: g.tours }));

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
                String(charterHits.length),
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
        (
            <HubCompareSection
                key='compare'
                tables={compareTables}
                dict={{
                    title: hubDict.comparison.title,
                    subtitle: hubDict.comparison.subtitle,
                    from: listingsDict.from,
                    book: hubDict.comparison.book,
                }}
            />
        ),
        (
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
            />
        ),
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

/** Skeleton mirroring the trips section (sticky tab row + card grid). */
function HubTripsSkeleton() {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container flex flex-col gap-8'>
                <div className='flex gap-3'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div
                            key={i}
                            className='h-9 w-28 shrink-0 animate-pulse rounded-it-full bg-it-heading/10'
                        />
                    ))}
                </div>
                <div className='flex flex-col gap-2'>
                    <div className='h-8 w-2/3 animate-pulse rounded bg-it-heading/10' />
                    <div className='h-4 w-1/3 animate-pulse rounded bg-it-heading/10' />
                </div>
                <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3'>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className='flex flex-col gap-3'>
                            <div className='aspect-4/3 w-full animate-pulse rounded-it-lg bg-it-heading/10' />
                            <div className='h-5 w-3/4 animate-pulse rounded bg-it-heading/10' />
                            <div className='h-4 w-1/2 animate-pulse rounded bg-it-heading/10' />
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
