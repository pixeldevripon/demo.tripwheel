import { DestinationCollections } from '@/components/frontend/destination/destination-collections';
import {
    DestinationExploreTypes,
    type ExploreType,
} from '@/components/frontend/destination/destination-explore-types';
import { DestinationHero } from '@/components/frontend/destination/destination-hero';
import { DestinationListings } from '@/components/frontend/destination/destination-listings';
import {
    getActiveCollectionsForDestination,
    getDestinationCategories,
    getDestinationHubs,
    getDestinationTours,
} from '@/lib/api/public';
import { getMediaSeo, normalizeUrl } from '@/lib/api/public/media';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { getServerCurrency } from '@/lib/currency/server';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { searchHitToListing } from '@/lib/tours/listing';

/**
 * Cached sections of the destination page. The route resolves the island
 * (name / id / hero image) + dictionary and passes them in; each section here does
 * its own extra fetch against a `'use cache'` loader. The destination route is
 * prerendered, so these render into the static shell (instant, kept fresh via
 * cache tags) rather than streaming - the route's `loading.tsx` covers the initial
 * paint on client navigation / cold on-demand renders.
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
    const [categories, hubs, heroSeo] = await Promise.all([
        getDestinationCategories(destination, locale),
        getDestinationHubs(destination, locale),
        // Independent of the other two - joins the same Promise.all rather than
        // adding a third round-trip to the hero's critical path.
        getMediaSeo([heroImage], locale),
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
    const activities = exploreTypes
        .slice(0, 4)
        .map(item => ({
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
                imageAlt={
                    heroImage
                        ? heroSeo.get(normalizeUrl(heroImage))?.altText
                        : null
                }
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
    const currency = await getServerCurrency(locale);
    const [favouriteTours, allTours] = await Promise.all([
        getDestinationTours({
            destinationId: islandId,
            locale,
            currency,
            localsFavourite: true,
            sort: 'recommended',
            limit: 6,
        }),
        getDestinationTours({ destinationId: islandId, limit: 1 }),
    ]);
    const tours = favouriteTours.data.map(hit =>
        searchHitToListing(hit, locale, dict.search)
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

export async function DestinationCollectionsSection({
    destination,
    locale,
    dict,
}: Omit<ListingsSectionProps, 'islandId' | 'destinationName'>) {
    const collections = await getActiveCollectionsForDestination(
        destination,
        locale
    );
    if (collections.length === 0) return null;

    return (
        <DestinationCollections
            dict={dict.destination.collections}
            collections={collections}
            locale={locale}
            destinationSlug={destination}
        />
    );
}

