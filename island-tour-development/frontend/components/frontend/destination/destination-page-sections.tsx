import { connection } from 'next/server';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import {
    getDestinationCategories,
    getDestinationHubs,
    getDestinationTours,
} from '@/lib/api/public';
import { searchHitToListing } from '@/lib/tours/listing';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { DestinationHero } from '@/components/frontend/destination/destination-hero';
import {
    DestinationExploreTypes,
    type ExploreType,
} from '@/components/frontend/destination/destination-explore-types';
import { DestinationListings } from '@/components/frontend/destination/destination-listings';

/**
 * Async, streamed sections of the destination page. The route resolves the island
 * (name / id / hero image) + dictionary and passes them in; each section here does
 * its own extra fetch and is marked dynamic with `await connection()` so its
 * `<Suspense>` skeleton streams under Cache Components (data loaders stay cached).
 */

interface HeroSectionProps {
    destination: string;
    locale: Locale;
    dict: Dictionary;
    destinationName: string;
    heroImage?: string;
}

/**
 * Hero band + "Explore by type" row. Needs the destination's hubs + categories
 * (hubs lead) for the hero's "Popular" quick links and the explore cards.
 */
export async function DestinationHeroSection({
    destination,
    locale,
    dict,
    destinationName,
    heroImage,
}: HeroSectionProps) {
    await connection();
    const [categories, hubs] = await Promise.all([
        getDestinationCategories(destination, locale),
        getDestinationHubs(destination, locale),
    ]);

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

    // Card labels for the hero typeahead live in the shared listings dictionary.
    const search = {
        ...dict.search,
        pickupAvailable: dict.destination.listings.pickupAvailable,
        freeCancellation: dict.destination.listings.freeCancellation,
        from: dict.destination.listings.from,
    };

    return (
        <>
            <DestinationHero
                destinationName={destinationName}
                dict={dict.destination.hero}
                search={search}
                locale={locale}
                destinationSlug={destination}
                activities={activities}
                image={heroImage}
            />
            {exploreTypes.length > 0 && (
                <DestinationExploreTypes
                    dict={dict.destination.exploreTypes}
                    locale={locale}
                    destinationSlug={destination}
                    categories={exploreTypes}
                />
            )}
        </>
    );
}

interface ListingsSectionProps {
    destination: string;
    locale: Locale;
    dict: Dictionary;
    islandId: string;
    destinationName: string;
}

/**
 * "Locals' favorites" grid - tours flagged `isLocalsFavourite` (top 6, recommended
 * order). The CTA count is the destination-wide LIVE total (a cheap `limit: 1`
 * call), not the favourites count. Renders nothing when there are no favourites.
 */
export async function DestinationLocalFavourites({
    destination,
    locale,
    dict,
    islandId,
    destinationName,
}: ListingsSectionProps) {
    await connection();
    const [favouriteTours, allTours] = await Promise.all([
        getDestinationTours({
            destinationId: islandId,
            locale,
            localsFavourite: true,
            sort: 'recommended',
            limit: 6,
        }),
        getDestinationTours({ destinationId: islandId, limit: 1 }),
    ]);
    const tours = favouriteTours.data.map(hit =>
        searchHitToListing(hit, locale, dict.search),
    );
    if (tours.length === 0) return null;

    return (
        <DestinationListings
            dict={dict.destination.listings}
            tours={tours}
            destinationName={destinationName}
            locale={locale}
            destinationSlug={destination}
            totalCount={allTours.total}
        />
    );
}
