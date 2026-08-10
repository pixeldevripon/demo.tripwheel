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
    getDestinationPopularLinks,
    getDestinationTours,
} from '@/lib/api/public';
import { getMediaSeo, normalizeUrl } from '@/lib/api/public/media';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { buildDiscoveryLinks } from '@/lib/destination/discovery-links';
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

/** Tours the search panel offers before anything is typed (master 5.10). */
const ZERO_STATE_TOP_TOURS = 3;

interface HeroSectionProps {
    destination: string;
    locale: Locale;
    dict: Dictionary;
    /** Needed for the search panel's "Top tours" group, which lists by island id. */
    islandId: string;
    destinationName: string;
    heroImage?: string;
}

/**
 * Hero band + "Explore by type" row. Needs the destination's hubs + categories
 * (hubs lead) for the hero's "Popular" quick links and the explore cards.
 */
/** Hero "Popular" quick links (master 5.2 locks the top 3). */
const POPULAR_LINKS_MAX = 3;

/** Diacritic- and case-insensitive fold, so "Curacao" matches "Curaçao". */
const fold = (value: string) =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();

/**
 * "Best Things to Do in Curaçao" → "Best Things to Do". The Popular row sits
 * under an H1 that already names the island, so a target name ending
 * "in {island}" repeats it. Display only - the href still opens the
 * full-named page.
 */
function stripIslandSuffix(name: string, destinationName: string): string {
    const suffix = ` in ${destinationName}`;
    return fold(name).endsWith(fold(suffix))
        ? name.slice(0, name.length - suffix.length).trimEnd()
        : name;
}

export async function DestinationHeroSection({
    destination,
    locale,
    dict,
    islandId,
    destinationName,
    heroImage,
}: HeroSectionProps) {
    /*
     * The shopper's currency, so the zero state's tour rows carry the same
     * converted prices as every other card on the page. This reads the cookie,
     * which is a dynamic input - it costs nothing here because this section and
     * `DestinationLocalFavourites` (which has always read it) share one Suspense
     * boundary, so that boundary is already the page's dynamic hole.
     */
    const currency = await getServerCurrency(locale);

    const [
        categories,
        hubs,
        collections,
        curatedPopular,
        curatedSearchPanel,
        topTours,
        heroSeo,
    ] = await Promise.all([
        getDestinationCategories(destination, locale),
        getDestinationHubs(destination, locale),
        // Collections feed the hero's "Popular" links only - the cards below
        // stay hubs + categories, and collections keep their own section.
        getActiveCollectionsForDestination(destination, locale),
        // The admin's curation, already resolved + gated. Empty when this
        // island has none, which falls through to the automatic row below.
        getDestinationPopularLinks(destination, locale),
        getDestinationPopularLinks(destination, locale, 'SEARCH_PANEL'),
        /*
         * The zero state's "Top tours" group, in the platform's own recommended
         * order (spotlight placement, then tier rank, then quality score) - the
         * same ranking every listing on the site uses, so the panel cannot
         * become a side door around the tier economy operators pay into.
         * `total` doubles as the island's live tour count for the closing link,
         * which is why this is one call and not two.
         *
         * Not de-duplicated by category on purpose. The §3.8 diversity pass runs
         * server-side and page-locally, and on an island whose whole head is one
         * category (Curacao: the top six are all Boat Tours & Cruises) there is
         * nothing to pull up - over-fetching to give it room was tried and
         * changed nothing. Showing something other than the true top three would
         * mean the panel disagreeing with the listing it links to.
         */
        getDestinationTours({
            destinationId: islandId,
            locale,
            currency,
            sort: 'recommended',
            limit: ZERO_STATE_TOP_TOURS,
        }),
        // Independent of the others - joins the same Promise.all rather than
        // adding another round-trip to the hero's critical path.
        getMediaSeo([heroImage], locale),
    ]);

    const exploreTypes: ExploreType[] = [
        // A hub tile is a PLACE, not a category (MCK-19): the rail drops its
        // tour count - whose number depends on what you count - and shows the
        // pinned place tag plus this count-less line instead. The line is the
        // hub's `description` (the listings blurb, master E.4) - heroTagline
        // belongs to the hub page hero only.
        ...hubs.map(hub => ({
            name: hub.name,
            slug: hub.slug,
            kind: 'hub' as const,
            tagline: hub.description || null,
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

    /*
     * Hero "Popular" quick links - CURATED first, automatic as the fallback.
     *
     * "Popular" is an editorial claim, and no ordering rule over live data
     * reproduced the founder's four for Curacao (Klein Curacao, Best Things to
     * Do, Off-Road Tours, Boat Tours & Cruises): Off-Road is fifth by sortOrder
     * and joint-fourth by tour count, so it fell outside a row of four however
     * the row was sorted. Hence an admin-curated list, confirmed by the founder
     * ("no dynamic order matters here").
     *
     * The automatic row below is NOT dead code - it is what every uncurated
     * island still gets, so adding a destination never yields an empty hero.
     *
     * Either way every entry is GATED ON ITS PAGE RENDERING, the founder's
     * standing condition ("these must show when these collections and
     * categories have data to render page"), and gated UPSTREAM rather than
     * here: the curated endpoint re-checks each target, and these three lists
     * already contain only pages that open (a category needs >= 3 published
     * tours on the island, a collection must be published). A page that cannot
     * render is simply not in any of them, so it cannot be linked.
     *
     * Every label is the TARGET PAGE'S OWN NAME - "these links resolve to real
     * pages, so each label has to match the page it opens". Nothing is
     * hand-typed on either path. The ONE display transform is
     * `stripIslandSuffix`: a name ending "in {island}" drops that suffix here,
     * because the H1 directly above already says the island.
     *
     * Hubs, collections and categories all live in the same flat
     * `/{destination}/{slug}` namespace (the slug registry), so one href shape
     * covers all three.
     */
    const automaticPopular = [
        ...hubs.map(h => ({ name: h.name, slug: h.slug })),
        // The island's LEAD collection sits second - the founder's shape is
        // hub, collection, then activities. Only one: Curacao has three, and
        // all three together filled the row on their own, burying the very
        // activity pages it exists to surface.
        ...collections.slice(0, 1).map(c => ({ name: c.name, slug: c.slug })),
        ...categories.map(c => ({ name: c.name, slug: c.slug })),
    ].slice(0, 4);

    /*
     * TOP THREE, not four. The live build showed four and master 5.2 locks the
     * top 3 of the curated discovery list - the spec catch the client flagged
     * at the top of his S4h handoff while we were in this file.
     *
     * Applied to BOTH paths on purpose. Capping only the automatic list would
     * let a curated row of four slip through, which is the state the client was
     * looking at when he reported it.
     */
    const activities = (
        curatedPopular.length > 0 ? curatedPopular : automaticPopular
    )
        .slice(0, POPULAR_LINKS_MAX)
        .map(item => ({
            label: stripIslandSuffix(item.name, destinationName),
            href: localizeHref(locale, `/${destination}/${item.slug}`),
        }));

    /*
     * Zero-state panel for the hero search (master 5.10): what the field offers
     * the moment it is focused, for "the visitor who does not yet know what they
     * want to do". Four parts, in this order - Categories & Hubs, Collections,
     * Top tours, and a closing link to everything.
     *
     * The first two are CURATED, same table and same rules as the hero's Popular
     * row, just a different `placement`. Curation is needed for the same reason
     * it was there: the client's own Curacao panel (Klein Curacao, Boat Tours &
     * Cruises, Off-Road Tours, Day Trips) is not any ordering of the automatic
     * list, because Off-Road is fifth by sortOrder.
     *
     * With nothing curated it falls back to the island's own gated lists, so a
     * new island opens a full panel on the day it goes live and an admin curates
     * only when they want something other than the obvious. Either way every row
     * opens a page that renders: the curated endpoint re-gates each target, and
     * these three lists only ever contain live pages.
     *
     * Hubs lead their group on the automatic path: an island's landmark is a
     * better starting point than an activity type, and it is what "Explore by
     * type" leads with too.
     */
    const zeroHref = (slug: string) =>
        localizeHref(locale, `/${destination}/${slug}`);

    const categoryNameById = new Map(categories.map(c => [c.id, c.name]));

    // The SAME builder the search recovery band's "Popular searches" run uses,
    // so the two surfaces can never answer "what is popular here" differently.
    const zeroEntries = buildDiscoveryLinks({
        curated: curatedSearchPanel,
        hubs,
        categories,
        collections,
    }).map(entry => ({
        name: entry.name,
        href: zeroHref(entry.slug),
        kind: entry.kind,
        // A collection carries no count (membership is editorial), and
        // `undefined` is what the row reads as "print no subtitle".
        tours: entry.tours ?? undefined,
        image: entry.image,
    }));

    const searchZeroState = {
        // Grouped by what the row OPENS rather than by two curated lists: the
        // admin orders one list and the panel decides which heading each row
        // belongs under, so a slot can never end up under the wrong heading.
        categoriesAndHubs: zeroEntries.filter(entry => entry.kind !== 'collection'),
        collections: zeroEntries.filter(entry => entry.kind === 'collection'),
        /*
         * The rows print their tour's primary category above the title, exactly
         * as the typed results do. The listing endpoint carries the category ID
         * but not its localized name, and this component has already fetched the
         * island's categories - so it is a lookup, not another request. A tour
         * whose primary category is not in that list (a sub-category, or one
         * under the 3-tour bar) simply gets no context line, which is what the
         * row already does with a null label.
         */
        topTours: topTours.data.map(hit => ({
            ...hit,
            categoryName:
                categoryNameById.get(hit.primaryCategoryId ?? '') ?? null,
        })),
        // Dropped entirely at zero: "See all 0 tours" is a link to an empty page.
        allTours:
            topTours.total > 0
                ? {
                      label: dict.destination.listings.seeAllCount
                          .replace('{count}', String(topTours.total))
                          .replace('{destination}', destinationName),
                      href: localizeHref(locale, `/${destination}/tours`),
                  }
                : null,
    };

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
                searchZeroState={searchZeroState}
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
                    destinationName={destinationName}
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

