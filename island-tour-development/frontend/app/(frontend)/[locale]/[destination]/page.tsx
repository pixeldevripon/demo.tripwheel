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
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { notFound } from 'next/navigation';

// Destination display names (proper nouns — not translated, only resolved from the slug).
const DESTINATION_NAMES: Record<string, string> = {
    curacao: 'Curaçao',
    aruba: 'Aruba',
    'sint-maarten': 'Sint Maarten',
    'saint-lucia': 'Saint Lucia',
    bonaire: 'Bonaire',
};

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

// "Explore by type" cards (placeholder — comes from the API later).
const EXPLORE_TYPES: ExploreType[] = [
    {
        name: 'Klein Curaçao',
        slug: 'klein-curacao',
        tours: 42,
        image: '/images/home-page/islands/curacao.jpg',
    },
    {
        name: 'Boat Tours',
        slug: 'boat-tours',
        tours: 42,
        image: '/images/home-page/categories/catamaran-trips.jpg',
    },
    {
        name: 'Sunset Cruises',
        slug: 'sunset-cruises',
        tours: 42,
        image: '/images/home-page/islands/aruba.jpg',
    },
    {
        name: 'Off-Road Tours',
        slug: 'off-road-tours',
        tours: 42,
        image: '/images/home-page/categories/buggy-tours.jpg',
    },
    {
        name: 'Snorkeling Trips',
        slug: 'snorkeling',
        tours: 42,
        image: '/images/home-page/categories/snorkel-trips.jpg',
    },
    {
        name: 'Private Charters',
        slug: 'luxury-experiences',
        tours: 42,
        image: '/images/home-page/islands/saint-lucia.jpg',
    },
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

/** Prerender the known destinations so `params` is static (no request-time dynamic hole). */
export function generateStaticParams() {
    return Object.keys(DESTINATION_NAMES).map(destination => ({ destination }));
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
    const destinationName =
        DESTINATION_NAMES[destination] ??
        destination.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    return (
        <>
            <DestinationHero
                destinationName={destinationName}
                dict={dict.destination.hero}
                locale={locale as Locale}
                popular={POPULAR[destination] ?? DEFAULT_POPULAR}
            />
            <DestinationExploreTypes
                dict={dict.destination.exploreTypes}
                locale={locale as Locale}
                destinationSlug={destination}
                categories={EXPLORE_TYPES}
            />
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

