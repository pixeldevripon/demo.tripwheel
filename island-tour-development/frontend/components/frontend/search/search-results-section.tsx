import { format, parse } from 'date-fns';

import type { ExploreType } from '@/components/frontend/destination/explore-types-rail';
import { Reveal } from '@/components/frontend/reveal';
import { SearchPagination } from '@/components/frontend/search-pagination';
import {
    SearchRecovery,
    THIN_RESULTS_MAX,
} from '@/components/frontend/search/search-recovery';
import { SearchResultsHeader } from '@/components/frontend/search/search-results-header';
import { TourCard } from '@/components/frontend/tour-card';
import { ToursBrowser } from '@/components/frontend/tours/tours-browser';
import { ToursFilterBar } from '@/components/frontend/tours/tours-filter-bar';
import { EMPTY_FILTERS } from '@/components/frontend/tours/tours-filter-modal';
import {
    getActiveCategories,
    getActiveCollectionsForDestination,
    getActiveDestinations,
    getDestinationCategories,
    getDestinationFacets,
    getDestinationHubs,
    getDestinationPopularLinks,
    getDestinationTours,
    searchTours,
} from '@/lib/api/public';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { getServerCurrency } from '@/lib/currency/server';
import { buildDiscoveryLinks } from '@/lib/destination/discovery-links';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { DestinationPopularLink } from '@/types/destination';
import {
    filtersToTourQuery,
    parseToursFilters,
    PRICE_MAX,
    SEARCH_SORT_PROFILE,
    toBackendSort,
} from '@/lib/tours/filters';
import { searchHitToListing, TOUR_CARD_GRID } from '@/lib/tours/listing';

const PAGE_SIZE = 12;

/** Locals' favorites shown inside the recovery band - one row on every breakpoint. */
const RECOVERY_FAVOURITES = 4;

interface SearchResultsSectionProps {
    locale: Locale;
    dict: Dictionary;
    /** Route search params (forwarded unresolved so the shell stays prerendered). */
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Async, streamed body of the global search page (`/[locale]/search`): the
 * head (scope pill + outcome heading + next-step line), the filter/sort
 * toolbar, and the paginated result grid, plus the recovery band whenever the
 * search found little or nothing. Reads the query from `searchParams` (`await
 * searchParams` below), which is itself the request-time trigger that makes it
 * stream into its own `<Suspense>` boundary under Cache Components while the
 * shell (navbar/footer) prerenders. No `connection()` needed.
 *
 * The toolbar is the SAME `ToursFilterBar` All Tours mounts (Pastel #44) - date
 * chip, travellers pill, Filters modal and the category chip row - differing
 * only by prop: "Most relevant" leads the sort menu and is the default here
 * (`SEARCH_SORT_PROFILE`), and the toolbar's own result counter is suppressed
 * because the heading above already carries the only count this page has
 * (mck-12). Every filter, the date, the travellers and the sort live in the
 * URL, so a result page is shareable and survives a reload and the back button.
 */
export async function SearchResultsSection({
    locale,
    dict,
    searchParams,
}: SearchResultsSectionProps) {
    const sp = await searchParams;
    const t = dict.search;
    const query = (first(sp.q) ?? '').trim();
    const destination = first(sp.destination)?.trim() || undefined;

    // Card labels live in the shared listings dictionary (the canonical TourCard
    // label set); the search section only adds page chrome + duration units.
    const cardDict = dict.destination.listings;

    // Price bounds and the category chip row come from the scoped island when
    // there is one; an unscoped (all-islands) search has no single island whose
    // bounds or tour-gated category set would be the right one, so it falls back
    // to the static ceiling and every ACTIVE category. Resolve the scoped
    // island's display name for the pill in the same pass - all independent
    // cached loaders, so they run together rather than serially.
    const [destinations, facets, islandCategories, allCategories, currency, popular] =
        await Promise.all([
            destination ? getActiveDestinations(locale) : Promise.resolve(null),
            destination
                ? getDestinationFacets(destination)
                : Promise.resolve(null),
            // Kept as two typed results rather than one union: only the
            // island-scoped rows carry `publishedTourCount`, and the tile rail
            // below needs that distinction at the type level, not a cast.
            destination
                ? getDestinationCategories(destination, locale)
                : Promise.resolve(null),
            destination ? Promise.resolve(null) : getActiveCategories(locale),
            getServerCurrency(locale),
            // The recovery band's "popular searches" run. Island-scoped by
            // nature, so an all-islands search simply has none.
            //
            // SEARCH_PANEL is the placement the mockup names ("from the CMS
            // zero-state set"), with the hero's own curated row as the
            // fallback: both are the same admin-curated table, both are
            // re-gated on the target page rendering, and an island that has
            // curated one but not the other should still get a row rather than
            // a silently missing group.
            destination
                ? getDestinationPopularLinks(
                      destination,
                      locale,
                      'SEARCH_PANEL'
                  ).then(links =>
                      links.length
                          ? links
                          : getDestinationPopularLinks(destination, locale)
                  )
                : Promise.resolve([]),
        ]);
    // The chip row takes either set; only the name/slug/id are read there.
    const categories = islandCategories ?? allCategories ?? [];
    const island = destinations?.find(d => d.slug === destination) ?? null;
    const destinationName = island?.name ?? null;
    const priceMax =
        facets?.priceRange?.max != null
            ? Math.max(10, Math.ceil(facets.priceRange.max / 10) * 10)
            : PRICE_MAX;

    const filters = parseToursFilters(sp, priceMax, SEARCH_SORT_PROFILE);
    const tourQuery = filtersToTourQuery(filters, priceMax);

    // Chips are selected by SLUG in the URL (readable, stable) and filtered by
    // ID on the backend. A slug with no match here is dropped rather than sent
    // on - a stale link must not silently filter to nothing.
    const categoryIds = filters.categories
        .map(slug => categories.find(c => c.slug === slug)?.id)
        .filter((id): id is string => Boolean(id));
    const filterCategories = categories.map(c => ({
        label: c.name,
        slug: c.slug,
    }));

    const searchArgs = {
        q: query,
        locale,
        currency,
        destinationSlug: destination,
        categoryIds: categoryIds.length ? categoryIds.join(',') : undefined,
        ...tourQuery,
        // `filtersToTourQuery` returns a listing-safe sort; only this endpoint
        // can honour "Most relevant".
        sort: toBackendSort(filters.sort),
    };

    const results =
        query.length >= 2
            ? await searchTours({
                  ...searchArgs,
                  page: filters.page,
                  limit: PAGE_SIZE,
              })
            : null;

    const listings =
        results?.data.map(hit =>
            searchHitToListing(hit, locale, t, filters.date ?? undefined)
        ) ?? [];
    const total = results?.total ?? 0;
    const totalPages = results ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 0;

    // The toolbar's own chip reads "6 Aug"; the heading, the zero-state line and
    // the date-drop chip all name the same date, so they format it the same way.
    const dateLabel = filters.date
        ? format(parse(filters.date, 'yyyy-MM-dd', new Date()), 'd MMM')
        : null;

    // The same search with the date dropped - the first thing the recovery band
    // offers, because a date is usually what emptied the result set. Null when
    // the query carried no date, in which case the option is meaningless and is
    // not rendered at all.
    const withoutDateHref = filters.date
        ? (() => {
              const params = new URLSearchParams();
              for (const [key, value] of Object.entries(sp)) {
                  if (key === 'date' || key === 'page') continue;
                  const v = first(value);
                  if (v) params.set(key, v);
              }
              const qs = params.toString();
              const path = localizeHref(locale, '/search');
              return qs ? `${path}?${qs}` : path;
          })()
        : null;

    // Anything beyond the bare term that is narrowing the result set. The date
    // is excluded - it has its own, better-worded action above.
    const hasActiveFilters =
        filters.categories.length > 0 ||
        filters.rating != null ||
        filters.durations.length > 0 ||
        filters.timeOfDay.length > 0 ||
        filters.cancellation != null ||
        filters.pickup ||
        filters.price[0] > 0 ||
        filters.price[1] < priceMax ||
        Object.keys(filters.attributes).length > 0;

    // The bare term (and island), every filter dropped.
    const clearFiltersHref = hasActiveFilters
        ? (() => {
              const params = new URLSearchParams();
              if (query) params.set('q', query);
              if (destination) params.set('destination', destination);
              const qs = params.toString();
              const path = localizeHref(locale, '/search');
              return qs ? `${path}?${qs}` : path;
          })()
        : null;

    // Below the 2-character floor there is nothing to filter, so the toolbar
    // would only offer controls that cannot change anything.
    if (query.length < 2) {
        return (
            <div className='it-container'>
                <EmptyState title={t.promptTitle} hint={t.promptHint} />
            </div>
        );
    }

    /*
     * Everything the recovery band needs, fetched ONLY when the band will
     * actually render. On a healthy search (the overwhelming majority) this
     * whole block is skipped, so the page costs exactly what it did before;
     * a dead-end search pays for one extra parallel round instead of leaving
     * the traveller with nowhere to go.
     *
     * `withoutDateCount` is a real second search, not an estimate: the band
     * promises "drop the date and N tours come back", and the only honest way
     * to put a number on that is to run it. When it comes back 0 the line is
     * dropped entirely rather than sending the traveller round a loop.
     */
    const needsRecovery = total <= THIN_RESULTS_MAX;
    const [withoutDateResults, hubs, favourites, collections] = needsRecovery
        ? await Promise.all([
              filters.date
                  ? searchTours({
                        ...searchArgs,
                        // Guests and time-of-day are date-anchored on the
                        // backend; dropping the date drops them with it.
                        date: undefined,
                        guests: undefined,
                        timeOfDay: undefined,
                        page: 1,
                        limit: 1,
                    })
                  : Promise.resolve(null),
              destination
                  ? getDestinationHubs(destination, locale)
                  : Promise.resolve([]),
              island
                  ? getDestinationTours({
                        destinationId: island.id,
                        locale,
                        currency,
                        localsFavourite: true,
                        sort: 'recommended',
                        limit: RECOVERY_FAVOURITES,
                    })
                  : Promise.resolve(null),
              // Only when there is nothing curated to show - see the automatic
              // fallback below.
              destination && popular.length === 0
                  ? getActiveCollectionsForDestination(destination, locale)
                  : Promise.resolve([]),
          ])
        : [null, [], null, []];

    // Hubs lead the rail, same order as the destination page's "Explore by
    // type" - an island's landmark is a better starting point than an activity
    // type.
    //
    // Island-scoped only, and not merely because the tile URLs need a
    // destination: an unscoped search reads `getActiveCategories`, whose rows
    // carry no `publishedTourCount`, so a tile there could not honestly print
    // "15 tours". A category with no count is dropped rather than shown as 0.
    const exploreTypes: ExploreType[] = [
        // Hub tiles lead the rail and render exactly like the category tiles
        // - name + tour count (client, Aug 13 2026: the mck-19 place tag and
        // count-less tagline are reverted).
        ...hubs.map(hub => ({
            name: hub.name,
            slug: hub.slug,
            tours: hub.publishedTourCount,
            image: hub.heroImage ?? undefined,
        })),
        ...(islandCategories ?? []).map(category => ({
            name: category.name,
            slug: category.slug,
            tours: category.publishedTourCount,
            image: category.heroImage ?? undefined,
        })),
    ];

    /*
     * "Popular searches" - the island's discovery set, cut to a single line.
     *
     * THE SAME LIST THE HERO SEARCH PANEL SHOWS, from the same builder: the
     * client's requirement is that this line "exactly represents" the curated
     * search items, and the only way to guarantee that is for both surfaces to
     * call one function rather than each assemble its own idea of popular.
     * Curated (SEARCH_PANEL, then the hero's row) wins; otherwise it is the
     * island's hubs, then activity types, then collections.
     */
    const popularLinks: DestinationPopularLink[] = buildDiscoveryLinks({
        curated: popular,
        hubs,
        categories: islandCategories ?? [],
        collections,
    });

    const recovery = (thinCount?: number) => (
        <SearchRecovery
            locale={locale}
            dict={t}
            localsDict={cardDict}
            cardDict={cardDict}
            toursLabel={dict.destination.exploreTypes.tours}
            query={query}
            dateLabel={dateLabel}
            dateParam={filters.date ?? null}
            withoutDateHref={withoutDateHref}
            withoutDateCount={withoutDateResults?.total ?? 0}
            clearFiltersHref={clearFiltersHref}
            popular={popularLinks}
            exploreTypes={exploreTypes}
            localsFavourites={
                favourites?.data.map(hit =>
                    // Same date on the tour page the card opens.
                    searchHitToListing(hit, locale, t, filters.date ?? undefined)
                ) ?? []
            }
            destinationSlug={destination}
            destinationName={destinationName}
            destinationTourCount={island?.tourCount}
            thinCount={thinCount}
        />
    );

    return (
        <ToursBrowser
            header={
                <div className='mb-7'>
                    <SearchResultsHeader
                        dict={t}
                        query={query}
                        total={total}
                        destinationName={destinationName}
                        dateLabel={dateLabel}
                    />
                </div>
            }
            toolbar={
                // NOTHING TO FILTER. A toolbar over an empty grid offers to
                // sort nothing and narrow nothing. The recovery band below owns
                // the way out instead - including `Clear all filters` when a
                // filter is what emptied the page, so hiding the toolbar can
                // never trap anyone.
                total === 0 ? null : (
                <ToursFilterBar
                    dict={dict.destination.allTours.toolbar}
                    sortDict={dict.destination.allTours.sort}
                    filterDict={dict.destination.allTours.filterModal}
                    hasReviews
                    categories={filterCategories}
                    sortProfile={SEARCH_SORT_PROFILE}
                    // The term and the island scope are the route's, not the
                    // filter model's - carry them through every toolbar nav.
                    extraParams={{ q: query, destination }}
                    priceMax={priceMax}
                    currency={currency}
                    locale={locale}
                    attributes={filters.attributes}
                    shown={listings.length}
                    total={total}
                    // The heading states the count. Repeating it here is the
                    // "3.12 dual count", which the search mockup explicitly
                    // does not carry.
                    showCount={false}
                    selectedCategories={filters.categories}
                    selectedDate={filters.date ?? undefined}
                    guests={filters.guests}
                    sort={filters.sort}
                    activeFilters={{
                        ...EMPTY_FILTERS,
                        price: filters.price,
                        rating: filters.rating,
                        durations: filters.durations,
                        times: filters.timeOfDay,
                        cancellation: filters.cancellation,
                        pickupAvailable: filters.pickup,
                    }}
                />
                )
            }
            results={
                total === 0 ? null : (
                    <Reveal className='flex flex-col gap-12 sm:gap-18'>
                        <div className={TOUR_CARD_GRID}>
                            {listings.map((tour, i) => (
                                <TourCard
                                    key={tour.id}
                                    tour={tour}
                                    dict={cardDict}
                                    // Pairs with TOUR_CARD_GRID's single mobile
                                    // column - the two are one decision.
                                    mobileRow
                                    // First ROW only (4 at lg) - see TourCardProps.
                                    priority={i < 4}
                                />
                            ))}
                        </div>

                        <SearchPagination pageCount={totalPages} />
                    </Reveal>
                )
            }
            // The band is a full-bleed tinted section, so it sits OUTSIDE the
            // results container. Zero: it is the whole state, and the grid above
            // is empty. Thin: the matches are still listed, with the way out
            // beneath them - a search with two hits is a dead end even though
            // the grid is not empty.
            footer={
                needsRecovery
                    ? recovery(total === 0 ? undefined : total)
                    : undefined
            }
        />
    );
}

/** A route search param can arrive repeated; the filter model takes the first. */
function first(v: string | string[] | undefined): string | undefined {
    return Array.isArray(v) ? v[0] : v;
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
    return (
        <div className='flex flex-col items-center gap-2 py-16 text-center'>
            <p className='m-0 font-medium text-[16.5px] md:text-[19.5px] leading-[1.3] text-it-heading tracking-[-0.012em]'>
                {title}
            </p>
            <p className='m-0 max-w-md text-[13px] md:text-[14.5px] leading-[1.6] text-it-heading/60 tracking-[-0.012em]'>
                {hint}
            </p>
        </div>
    );
}
