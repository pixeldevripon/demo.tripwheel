import { DestinationAbout } from '@/components/frontend/destination-about';
import {
    DestinationExploreTypes,
    type ExploreType,
} from '@/components/frontend/destination/destination-explore-types';
import { DestinationHero } from '@/components/frontend/destination/destination-hero';
import { DestinationInstagram } from '@/components/frontend/destination-instagram';
import {
    DestinationListings,
} from '@/components/frontend/destination/destination-listings';
import { FaqSection } from '@/components/frontend/faq-section';
import {
    getDestinationBySlug,
    getDestinationCategories,
    getDestinationHubs,
    getDestinationTours,
} from '@/lib/api/public';
import { isLocale, localizeHref, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { searchHitToListing } from '@/lib/tours/listing';
import { notFound } from 'next/navigation';

// Destination display names (proper nouns - not translated, only resolved from the slug).
const DESTINATION_NAMES: Record<string, string> = {
    curacao: 'Curaçao',
    aruba: 'Aruba',
    'sint-maarten': 'Sint Maarten',
    'saint-lucia': 'Saint Lucia',
    bonaire: 'Bonaire',
};

/** Prerender the known destinations so `params` is static (no request-time dynamic hole). */
export function generateStaticParams() {
    return Object.keys(DESTINATION_NAMES).map(destination => ({ destination }));
}

/**
 * Destination page - `/[locale]/[destination]` (e.g. /en/curacao).
 * Hero is built; the rest of the page follows section by section.
 */
export default async function DestinationPage({
    params,
}: {
    params: Promise<{ locale: string; destination: string }>;
}) {
    const { locale, destination } = await params;
    if (!isLocale(locale)) notFound();

    const [dict, island, categories, hubs] = await Promise.all([
        getDictionary(locale),
        getDestinationBySlug(destination, locale),
        getDestinationCategories(destination, locale),
        getDestinationHubs(destination, locale),
    ]);
    // Unknown or not-yet-launched (inactive) island → 404. getDestinationBySlug
    // resolves any slug, so we gate on isActive here for the public site.
    if (!island || !island.isActive) notFound();

    const destinationName = island.name;

    // Hubs (e.g. Klein Curaçao) and categories share the same flat
    // `/{destination}/{slug}` discovery URL, so both feed the hero "Popular" row
    // and the "Explore by type" cards - hubs always lead.
    const exploreTypes: ExploreType[] = [
        ...hubs.map(hub => ({
            name: hub.name,
            slug: hub.slug,
            tours: hub.publishedTourCount,
            image: hub.heroImage ?? undefined,
        })),
        ...categories.map(category => ({
            name: category.name,
            slug: category.slug,
            tours: category.publishedTourCount,
            image: category.heroImage ?? undefined,
        })),
    ];

    // Hero "Popular" quick links - same hubs-first ordering, capped at 4.
    const activities = exploreTypes.slice(0, 4).map(item => ({
        label: item.name,
        href: localizeHref(locale, `/${destination}/${item.slug}`),
    }));

    // Card labels for the typeahead live in the shared listings dictionary.
    const search = {
        ...dict.search,
        pickupAvailable: dict.destination.listings.pickupAvailable,
        freeCancellation: dict.destination.listings.freeCancellation,
        from: dict.destination.listings.from,
    };

    // "Locals' favorites" grid - tours flagged isLocalsFavourite for this island
    // (top 6, recommended order). The CTA count is the destination-wide LIVE total
    // (a cheap limit:1 call), NOT the favourites count - "See all {count} tours"
    // links to the full All Tours page.
    const [favouriteTours, allTours] = await Promise.all([
        getDestinationTours({
            destinationId: island.id,
            locale,
            localsFavourite: true,
            sort: 'recommended',
            limit: 6,
        }),
        getDestinationTours({ destinationId: island.id, limit: 1 }),
    ]);
    const tours = favouriteTours.data.map(hit =>
        searchHitToListing(hit, locale as Locale, dict.search),
    );

    return (
        <>
            <DestinationHero
                destinationName={destinationName}
                dict={dict.destination.hero}
                search={search}
                locale={locale as Locale}
                destinationSlug={destination}
                activities={activities}
                image={island.heroImage ?? undefined}
            />
            {exploreTypes.length > 0 && (
                <DestinationExploreTypes
                    dict={dict.destination.exploreTypes}
                    locale={locale as Locale}
                    destinationSlug={destination}
                    categories={exploreTypes}
                />
            )}
            {tours.length > 0 && (
                <DestinationListings
                    dict={dict.destination.listings}
                    tours={tours}
                    destinationName={destinationName}
                    locale={locale as Locale}
                    destinationSlug={destination}
                    totalCount={allTours.total}
                />
            )}
            <DestinationInstagram dict={dict.destination.instagram} />

            <FaqSection dict={dict.home.faq} />
            <DestinationAbout
                destinationName={destinationName}
                dict={dict.destination.about}
            />
        </>
    );
}

