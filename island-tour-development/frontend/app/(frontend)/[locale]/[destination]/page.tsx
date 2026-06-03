import { notFound } from 'next/navigation';
import { DestinationHero } from '@/components/frontend/destination-hero';
import {
    DestinationExploreTypes,
    type ExploreType,
} from '@/components/frontend/destination-explore-types';
import { DestinationAbout } from '@/components/frontend/destination-about';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { FaqSection } from '@/components/frontend/faq-section';

// Destination display names (proper nouns — not translated, only resolved from the slug).
const DESTINATION_NAMES: Record<string, string> = {
    curacao: 'Curaçao',
    aruba: 'Aruba',
    'sint-maarten': 'Sint Maarten',
    'saint-lucia': 'Saint Lucia',
    bonaire: 'Bonaire',
};

// Popular searches per destination (placeholder — comes from the API later).
const POPULAR: Record<string, { label: string; slug: string }[]> = {
    curacao: [
        { label: 'Klein Curaçao', slug: 'klein-curacao' },
        { label: 'Sunset Cruises', slug: 'sunset-cruises' },
        { label: 'Buggy Tours', slug: 'buggy-tours' },
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
        name: 'Buggy Tours',
        slug: 'buggy-tours',
        tours: 42,
        image: '/images/home-page/categories/buggy-tours.jpg',
    },
    {
        name: 'Snorkeling Trips',
        slug: 'snorkeling-trips',
        tours: 42,
        image: '/images/home-page/categories/snorkel-trips.jpg',
    },
    {
        name: 'Private Charters',
        slug: 'private-charters',
        tours: 42,
        image: '/images/home-page/islands/saint-lucia.jpg',
    },
];

/** Prerender the known destinations so `params` is static (no request-time dynamic hole). */
export function generateStaticParams() {
    return Object.keys(DESTINATION_NAMES).map((destination) => ({ destination }));
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
        destination.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

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

            <FaqSection dict={dict.home.faq} />
            <DestinationAbout
                destinationName={destinationName}
                dict={dict.destination.about}
            />
        </>
    );
}

