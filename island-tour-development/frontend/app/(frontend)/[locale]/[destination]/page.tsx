import { notFound } from 'next/navigation';
import { DestinationHero } from '@/components/frontend/destination-hero';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { DestinationExploreTypes } from '@/components/frontend/destination-explore-types';

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
                categories={[
                    { name: 'Boat Tours', slug: 'boat-tours', tours: 12 },
                    { name: 'Snorkeling', slug: 'snorkeling', tours: 8 },
                    {
                        name: 'Island Hopping',
                        slug: 'island-hopping',
                        tours: 5,
                    },
                    { name: 'Diving', slug: 'diving', tours: 7 },
                    { name: 'Fishing', slug: 'fishing', tours: 3 },
                    {
                        name: 'Island Hopping',
                        slug: 'island-hopping',
                        tours: 5,
                    },
                    {
                        name: 'Island Hopping',
                        slug: 'island-hopping',
                        tours: 5,
                    },
                    {
                        name: 'Island Hopping',
                        slug: 'island-hopping',
                        tours: 5,
                    },
                    {
                        name: 'Island Hopping',
                        slug: 'island-hopping',
                        tours: 5,
                    },
                    {
                        name: 'Island Hopping',
                        slug: 'island-hopping',
                        tours: 5,
                    },
                    {
                        name: 'Island Hopping',
                        slug: 'island-hopping',
                        tours: 5,
                    },
                ]}
            />
        </>
    );
}






