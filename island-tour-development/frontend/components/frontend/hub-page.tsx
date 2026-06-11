import { notFound } from 'next/navigation';
import { hubsApi } from '@/lib/api/hubs';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { HubHero, type HubHeroMeta } from './hub-hero';
import { type HubPick } from './hub-pick-card';
import { type HubTour } from './hub-tour-card';
import { HubTripsSection } from './hub-trips-section';
import { HubWhySection } from './hub-why-section';
import { ToursBreadcrumb } from './tours-breadcrumb';

/**
 * Activity Hub page — the HUB branch of the polymorphic `[slug]` route
 * (`/{locale}/{destination}/{activity-hub}/`).
 *
 * Built section-by-section to match Figma (node 48024:11145). Currently:
 *   - reusable breadcrumb (`Home › {Destination} › {Hub}`)
 *   - hero (node 48024:11158)
 *   - "Why {hub}" editorial (node 48024:11174)
 *   - trips listing: tabs + per-tab panel (Trips grid node 48024:11222,
 *     Private charters grouped grids node 48024:11455)
 *
 * Multilingual + slug-registry contract (MULTILINGUAL-CONTENT.md §6.9,
 * ROUTING-AND-RESOLUTION.md §5.2): localized detail fetched per `locale`, fields
 * fall back to canonical English on the backend; slugs are English at every
 * locale. A hub renders whenever its resolve succeeds and `isActive` (no
 * published-tour gating — that applies to categories only).
 */

// Representative "at a glance" meta pills (Figma hero). Hub-level summary of the
// typical trip — placeholder until the per-tour attributes API is wired (mirrors
// the MOCK convention on the category page). Icons are white Figma exports.
const MOCK_HERO_META: HubHeroMeta[] = [
    { icon: '/icons/hub/meta-duration.svg', label: 'Full day (8–9h)' },
    { icon: '/icons/hub/meta-price.svg', label: 'From $120' },
    { icon: '/icons/hub/meta-inclusion.svg', label: 'BBQ lunch' },
    { icon: '/icons/hub/meta-frequency.svg', label: 'Daily' },
];

// Representative "Why {hub}" body — placeholder until the hub overview /
// page-content is authored (mirrors the MOCK convention on the category page).
const MOCK_WHY_PARAGRAPHS = [
    "The best beach in Curaçao isn't on Curaçao. Klein Curaçao lies 10km offshore — a flat, uninhabited island where nothing stays except a lighthouse built in 1877 and sea turtles that return here to nest every year. No shops. No signal. Just one of the longest stretches of white sand in the Caribbean. A full day to disappear. We've been on every boat that makes the trip. We've never met anyone who regretted going.",
    "The crossing sails against the trade winds. Some mornings it's glass-smooth. Others, the catamaran earns its way there. Worth it. All of it.",
];

// Representative trips grid (Figma node 48024:11222) — placeholder until the
// hub-filtered trips API is wired (mirrors the MOCK convention on the category
// page). First three carry the badges shown in the design.
const MOCK_TRIP_ATTRS = ['8h', 'Yacht', 'Beach house', 'Breakfast', 'Family-friendly'];
const MOCK_TRIPS: HubTour[] = Array.from({ length: 9 }, (_, i) => ({
    id: `hub-trip-${i + 1}`,
    image: null,
    badge: i === 0 ? 'sponsored' : i === 1 ? 'mostPopular' : i === 2 ? 'likelyToSellOut' : null,
    rating: 4.8,
    reviewCount: 1738,
    title: i === 2 ? 'Powerboat Adventure' : 'Yacht with Beach House',
    attributes:
        i === 2 ? ['6h', 'Powerboat', 'Beer & Wine included'] : MOCK_TRIP_ATTRS,
    price: i === 0 ? 150 : i === 2 ? 169 : 140,
    priceUnit: '/per',
    freeCancellation: true,
}));

// Private-charters panel (Figma node 48024:11455) — grouped grids with a
// per-person price note. Placeholder until the charters API is wired.
const MOCK_CHARTER_ATTRS = ['8h', 'Up to 10', 'Yacht', 'Beach house', 'BBQ', 'Family'];
const MOCK_DAY_CHARTERS: HubTour[] = Array.from({ length: 11 }, (_, i) => ({
    id: `hub-day-charter-${i + 1}`,
    image: null,
    badge: i === 0 ? 'sponsored' : null,
    rating: 4.8,
    reviewCount: 1738,
    title: i === 0 ? 'Catamaran with open bar' : 'Yacht with Beach House',
    attributes:
        i === 0 ? ['8h', 'Up to 10', 'Catamaran', 'Open bar'] : MOCK_CHARTER_ATTRS,
    price: i === 0 ? 1750 : 2200,
    priceUnit: i === 0 ? '/10 people' : '/8 people',
    priceNote: '+ $175 per extra person',
    freeCancellation: true,
}));
const MOCK_NIGHT_CHARTERS: HubTour[] = [
    'Powerboat with Overnight stay',
    'Yacht with Overnight stay',
    'Catamaran with Overnight stay',
].map((title, i) => ({
    id: `hub-night-charter-${i + 1}`,
    image: null,
    badge: null,
    rating: 4.8,
    reviewCount: 1738,
    title,
    attributes: ['24h', 'Up to 10', 'Cabins', 'Crew'],
    price: i === 1 ? 1400 : 1950,
    priceUnit: '/8 people',
    priceNote: '+ $175 per extra person',
    freeCancellation: true,
}));

// Editorial "We've been on every boat" top picks (Figma node 48024:11563) —
// part of the Private charters panel. Placeholder copy until authored.
const MOCK_PICK_CONTENT: Omit<HubPick, 'label' | 'labelText'>[] = [
    {
        id: 'pick-1',
        title: 'Yacht with Beach House',
        rating: 4.8,
        reviewCount: 1738,
        type: 'Yacht',
        description:
            "The island's only dive school, a massage with a million-dollar view, and a fully equipped beach house all on a quieter stretch, set apart from the other boats.",
        duration: 'Full day',
        price: 150,
        image: null,
    },
    {
        id: 'pick-2',
        title: 'Catamaran with Open Bar',
        rating: 4.8,
        reviewCount: 1738,
        type: 'Catamaran',
        description:
            'The biggest catamarans on the island and the best open bar of any Klein Curaçao trip. Most-booked year after year - for the ultimate Caribbean sailing vibe.',
        duration: 'Full day',
        price: 140,
        image: null,
    },
    {
        id: 'pick-3',
        title: 'Family Boat with Beach House',
        rating: 4.8,
        reviewCount: 1738,
        type: 'Motorboat',
        description:
            'A beach house with its own watch-tower a 360° view over the whole island. A calm, steady boat. Easy and relaxed for families and friends.',
        duration: 'Full day',
        price: 150,
        image: null,
    },
];

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
    // Localized hub detail (canonical English fallback handled by the backend).
    const hub = await hubsApi
        .getBySlug(hubSlug, destinationSlug, locale)
        .catch(() => null);

    if (!hub || !hub.isActive) notFound();

    const hubDict = dict.destination.hub;
    // Hero title: localized "{hub} day trips" pattern, overridable by the
    // backend's localized H1 when set.
    const title = hub.h1Override ?? hubDict.titlePattern.replace('{hub}', hub.name);
    const breadcrumbLabel = hub.breadcrumbLabel ?? hub.name;

    // "Why {hub}" body — authored hub overview (split on blank lines) when
    // present, else the representative placeholder.
    const whyTitle = hubDict.whyTitle.replace('{hub}', hub.name);
    const whyParagraphs = hub.overview?.trim()
        ? hub.overview.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
        : MOCK_WHY_PARAGRAPHS;

    // Trips/charters tabbed listing.
    const listingsDict = dict.destination.listings;
    const tripsTitle = hubDict.tripsHeading
        .replace('{count}', String(MOCK_TRIPS.length))
        .replace('{hub}', hub.name);
    const chartersDict = hubDict.charters;
    const picksDict = hubDict.picks;
    const pickLabels: HubPick['label'][] = ['best', 'popular', 'families'];
    const pickLabelText = [picksDict.best, picksDict.popular, picksDict.families];
    const picks: HubPick[] = MOCK_PICK_CONTENT.map((p, i) => ({
        ...p,
        label: pickLabels[i],
        labelText: pickLabelText[i],
    }));
    const tripsTabs = [
        { key: 'trips', label: hubDict.tabs.trips },
        { key: 'private-charters', label: hubDict.tabs.privateCharters },
        { key: 'compare', label: hubDict.tabs.compare },
        { key: 'discover', label: hubDict.tabs.discover },
    ];
    // Panels index-aligned to the tabs; Compare/Discover are not designed yet.
    const tripsPanels = [
        {
            title: tripsTitle,
            subtitle: hubDict.tripsSubtitle,
            groups: [{ tours: MOCK_TRIPS }],
        },
        {
            title: chartersDict.heading.replace(
                '{count}',
                String(MOCK_DAY_CHARTERS.length + MOCK_NIGHT_CHARTERS.length),
            ),
            subtitle: chartersDict.subtitle,
            groups: [
                {
                    title: `${chartersDict.dayCharters} (${MOCK_DAY_CHARTERS.length})`,
                    tours: MOCK_DAY_CHARTERS,
                },
                {
                    title: `${chartersDict.overnightCharters} (${MOCK_NIGHT_CHARTERS.length})`,
                    tours: MOCK_NIGHT_CHARTERS,
                },
            ],
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
        null,
        null,
    ];

    return (
        <>
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
                title={title}
                tagline={hubDict.tagline}
                meta={MOCK_HERO_META}
                dict={{
                    tagline: hubDict.tagline,
                    selectDate: hubDict.selectDate,
                    checkAvailability: hubDict.checkAvailability,
                }}
            />

            <HubWhySection
                title={whyTitle}
                paragraphs={whyParagraphs}
                learnMoreLabel={dict.destination.about.learnMore}
                readLessLabel={dict.destination.about.readLess}
            />

            <HubTripsSection
                dict={{
                    tabs: tripsTabs,
                    panels: tripsPanels,
                    selectDate: hubDict.selectDate,
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
        </>
    );
}
