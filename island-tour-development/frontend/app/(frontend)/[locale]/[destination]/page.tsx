import { DestinationAbout } from '@/components/frontend/destination-about';
import {
    DestinationExploreTypes,
    type ExploreType,
} from '@/components/frontend/destination-explore-types';
import { DestinationHero } from '@/components/frontend/destination-hero';
import { DestinationInstagram } from '@/components/frontend/destination-instagram';
import {
    DestinationListings,
} from '@/components/frontend/destination-listings';
import type { TourListing } from '@/components/frontend/tour-card';
import { FaqSection } from '@/components/frontend/faq-section';
import { categoriesApi } from '@/lib/api/categories';
import { destinationsApi } from '@/lib/api/destinations';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { notFound } from 'next/navigation';

// Fallback slugs for static generation if the backend is unreachable at build.
const LAUNCH_DESTINATION_SLUGS = [
    'curacao',
    'aruba',
    'sint-maarten',
    'saint-lucia',
    'bahamas',
];

// Total published tours per destination (placeholder — comes from the API later).
// Drives the conditional "See all {count} tours" CTA (count shown only when ≥ 20).
const DESTINATION_TOUR_COUNTS: Record<string, number> = {
    curacao: 87,
    aruba: 64,
    'sint-maarten': 38,
    'saint-lucia': 22,
    bonaire: 12,
};

// Popular searches per destination (placeholder — comes from the API later).
const POPULAR: Record<string, { label: string; slug: string }[]> = {
    curacao: [
        { label: 'Klein Curaçao', slug: 'klein-curacao' },
        { label: 'Sunset Cruises', slug: 'sunset-cruises' },
        { label: 'Off-Road Tours', slug: 'off-road-tours' },
    ],
};

const DEFAULT_POPULAR = [
    { label: 'Boat Tours', slug: 'boat-tours' },
    { label: 'Snorkeling', slug: 'snorkeling' },
    { label: 'Island Hopping', slug: 'island-hopping' },
];

// ── Locals' Favorites mock data (6 cards — replace with API data later) ─────
// Matches Figma node 47361:19645 exactly.
const TOURS: TourListing[] = [
    {
        id: 'tour-1',
        images: [
            '/images/tours/tour-1-1.jpg',
            '/images/tours/tour-1-2.jpg',
            '/images/tours/tour-1-3.jpg',
        ],
        badge: 'new',
        title: 'Klein Curaçao Catamaran Day Trip with Open bar & BBQ included',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: false,
    },
    {
        id: 'tour-2',
        images: [
            '/images/tours/tour-2-1.jpg',
            '/images/tours/tour-2-3.jpg',
        ],
        badge: 'likelyToSellOut',
        rating: 4.8,
        reviewCount: 1738,
        title: 'Sunset Sailing Cruise along Spanish Water with Unlimited drinks & appetizers',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'tour-3',
        images: [
            '/images/tours/tour-3-1.jpg',
            '/images/tours/tour-3-2.jpg',
            '/images/tours/tour-3-3.jpg',
        ],
        badge: 'mostPopular',
        rating: 4.8,
        reviewCount: 1738,
        title: 'Sunset Sailing Cruise along Spanish Water with Unlimited drinks & appetizers',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: true,
    },
    {
        id: 'tour-4',
        images: [
            '/images/tours/tour-4-1.jpg',
            '/images/tours/tour-4-2.jpg',
            '/images/tours/tour-4-3.jpg',
        ],
        badge: null,
        rating: 4.8,
        reviewCount: 1738,
        title: 'Private Yacht Charter for up to 12 guests with Custom itinerary & snorkel gear',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 270,
        priceUnit: 'perGroup',
        freeCancellation: false,
    },
    {
        id: 'tour-5',
        images: [
            '/images/tours/tour-5-1.jpg',
            '/images/tours/tour-3-2.jpg',
            '/images/tours/tour-3-3.jpg',
        ],
        badge: null,
        rating: 4.8,
        reviewCount: 1738,
        title: 'Snorkeling at Tugboat Beach with Small group (max 8)',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 270,
        priceUnit: 'perGroup',
        priceVaries: true,
        freeCancellation: true,
    },
    {
        id: 'tour-6',
        images: [
            '/images/tours/tour-6-1.jpg',
            '/images/tours/tour-1-2.jpg',
            '/images/tours/tour-6-3.jpg',
        ],
        badge: null,
        rating: 4.8,
        reviewCount: 1738,
        title: 'Sunset Sailing Cruise along Spanish Water with Unlimited drinks & appetizers',
        duration: '4 to 5 hours',
        pickupAvailable: true,
        price: 36,
        priceUnit: 'per',
        freeCancellation: true,
    },
];

/** Prerender active destinations from the backend; fall back to launch slugs. */
export async function generateStaticParams() {
    try {
        const destinations = await destinationsApi.getActive();
        if (destinations.length > 0) {
            return destinations.map(d => ({ destination: d.slug }));
        }
    } catch {
        // backend unavailable at build — fall through to launch slugs
    }
    return LAUNCH_DESTINATION_SLUGS.map(destination => ({ destination }));
}

/**
 * Destination page — `/[locale]/[destination]` (e.g. /en/curacao).
 * Hero is built; the rest of the page follows section by section.
 */
export default async function DestinationPage({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}) {
    const { locale, destination } = await params;
    if (!isLocale(locale)) notFound();

    const dict = await getDictionary(locale);

    // Resolve the destination from the backend (localized name). A missing or
    // inactive destination 404s (MULTILINGUAL-CONTENT.md §5.9–§5.10).
    const dest = await destinationsApi
        .getBySlug(destination, locale as Locale)
        .catch(() => null);
    if (!dest || !dest.isActive) notFound();
    const destinationName = dest.name;

    // "Explore by type" — categories that have ≥1 published tour at this
    // destination (localized, with real per-destination counts). Gating-consistent
    // with the category pages, so every card links to a page that will render.
    const exploreCategories: ExploreType[] = await categoriesApi
        .getActiveByDestination(destination, locale as Locale)
        .then(cats =>
            cats.map(c => ({
                name: c.name,
                slug: c.slug,
                tours: c.publishedTourCount,
                image: c.heroImage ?? undefined,
            })),
        )
        .catch(() => []);

    return (
        <>
            <DestinationHero
                destinationName={destinationName}
                dict={dict.destination.hero}
                locale={locale as Locale}
                popular={POPULAR[destination] ?? DEFAULT_POPULAR}
            />
            {exploreCategories.length > 0 && (
                <DestinationExploreTypes
                    dict={dict.destination.exploreTypes}
                    locale={locale as Locale}
                    destinationSlug={destination}
                    categories={exploreCategories}
                />
            )}
            <DestinationListings
                dict={dict.destination.listings}
                tours={TOURS}
                destinationName={destinationName}
                locale={locale as Locale}
                destinationSlug={destination}
                totalCount={DESTINATION_TOUR_COUNTS[destination] ?? TOURS.length}
            />
            <DestinationInstagram dict={dict.destination.instagram} />

            <FaqSection dict={dict.home.faq} />
            <DestinationAbout
                destinationName={destinationName}
                dict={dict.destination.about}
            />
        </>
    );
}

