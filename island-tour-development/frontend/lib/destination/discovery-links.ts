import type { DestinationPopularLink } from '@/types/destination';

/**
 * One entry a traveller can be sent to when they have not chosen anything yet:
 * an activity hub, an activity type, or an editorial collection.
 */
export type DiscoveryLink = {
    name: string;
    slug: string;
    kind: 'hub' | 'category' | 'collection';
    /** Live tours behind the page. `null` for collections - membership is editorial. */
    tours: number | null;
    image: string | null;
};

/** The island's own lists, in the shape the public loaders already return. */
export type DiscoverySources = {
    /** Admin curation for this placement. Wins outright when non-empty. */
    curated: DestinationPopularLink[];
    hubs: { name: string; slug: string; publishedTourCount: number; heroImage: string | null }[];
    categories: {
        name: string;
        slug: string;
        publishedTourCount: number;
        heroImage: string | null;
    }[];
    collections: { name: string; slug: string; heroImage: string | null }[];
};

/**
 * The island's discovery set - CURATED first, automatic as the fallback.
 *
 * ONE builder, because two surfaces show this same set and the client's
 * requirement is that they agree: the hero search field's zero-state panel
 * ("Categories & Hubs" + "Collections"), and the search recovery band's
 * "Popular searches" run. They were built independently and immediately
 * disagreed - the band led with a hub, then jumped to the lead collection
 * before naming a single activity type, while the panel listed hubs, then
 * activity types, then collections. Same island, same moment, two different
 * answers to "what is popular here".
 *
 * Curation is an editorial claim an admin makes per island, and no ordering
 * rule over live data reproduces it (the founder's Curacao four put Off-Road
 * fifth by sortOrder), so `curated` wins outright when it has anything in it.
 *
 * The automatic path is NOT dead code - it is what every uncurated island gets,
 * which is every island today. Hubs lead it: an island's landmark is a better
 * starting point than an activity type, and it is what "Explore by type" leads
 * with too. Collections close it, being editorial rather than a place or a
 * thing to do.
 *
 * EVERY ENTRY IS GATED ON ITS PAGE RENDERING, upstream rather than here: the
 * curated endpoint re-checks each target, and the three lists passed in already
 * contain only pages that open (a category needs >= 3 published tours on the
 * island, a collection must be published). A page that cannot render is not in
 * any of them, so it cannot be linked.
 */
export function buildDiscoveryLinks({
    curated,
    hubs,
    categories,
    collections,
}: DiscoverySources): DiscoveryLink[] {
    if (curated.length > 0) {
        return curated.map(link => ({
            name: link.name,
            slug: link.slug,
            kind: link.kind,
            tours: link.tours,
            image: link.image,
        }));
    }

    return [
        ...hubs.map(hub => ({
            name: hub.name,
            slug: hub.slug,
            kind: 'hub' as const,
            tours: hub.publishedTourCount,
            image: hub.heroImage,
        })),
        ...categories.map(category => ({
            name: category.name,
            slug: category.slug,
            kind: 'category' as const,
            tours: category.publishedTourCount,
            image: category.heroImage,
        })),
        ...collections.map(collection => ({
            name: collection.name,
            slug: collection.slug,
            kind: 'collection' as const,
            tours: null,
            image: collection.heroImage,
        })),
    ];
}
