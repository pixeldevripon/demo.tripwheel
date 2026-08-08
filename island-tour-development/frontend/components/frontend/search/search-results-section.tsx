import Link from 'next/link';

import { Reveal } from '@/components/frontend/reveal';
import { SearchPagination } from '@/components/frontend/search-pagination';
import { TourCard } from '@/components/frontend/tour-card';
import { ToursBrowser } from '@/components/frontend/tours/tours-browser';
import { ToursFilterBar } from '@/components/frontend/tours/tours-filter-bar';
import { EMPTY_FILTERS } from '@/components/frontend/tours/tours-filter-modal';
import {
    getActiveCategories,
    getActiveDestinations,
    getDestinationCategories,
    getDestinationFacets,
    searchTours,
} from '@/lib/api/public';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { getServerCurrency } from '@/lib/currency/server';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import {
    filtersToTourQuery,
    parseToursFilters,
    PRICE_MAX,
    SEARCH_SORT_PROFILE,
    toBackendSort,
} from '@/lib/tours/filters';
import { searchHitToListing, TOUR_CARD_GRID } from '@/lib/tours/listing';

const PAGE_SIZE = 12;

/**
 * A removable scope chip above the results. Only the DESTINATION scope needs
 * one now: it comes from the navbar's active island and the toolbar has no
 * control for it. Date, travellers, price and the rest live in the toolbar's own
 * chips, which are removable there.
 */
function ScopeChip({ href, label }: { href: string; label: string }) {
    return (
        <Link
            href={href}
            className='inline-flex w-fit items-center gap-2 rounded-it-full border border-it-border px-3 py-1.5 text-[13px] text-it-heading no-underline transition-colors hover:bg-it-surface'>
            {label}
            <span aria-hidden='true' className='text-it-heading/50'>
                ✕
            </span>
        </Link>
    );
}

interface SearchResultsSectionProps {
    locale: Locale;
    dict: Dictionary;
    /** Route search params (forwarded unresolved so the shell stays prerendered). */
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Async, streamed body of the global search page (`/[locale]/search`): the
 * result-count line, the destination-scope chip, the filter/sort toolbar, and
 * the paginated result grid (or an empty/prompt state). Reads the query from
 * `searchParams` (`await searchParams` below), which is itself the request-time
 * trigger that makes it stream into its own `<Suspense>` boundary under Cache
 * Components while the shell (heading + navbar/footer) prerenders. No
 * `connection()` needed.
 *
 * The toolbar is the SAME `ToursFilterBar` All Tours mounts (Pastel #44) - date
 * chip, travellers pill, Filters modal and the category chip row - differing
 * only by prop: "Most relevant" leads the sort menu and is the default here
 * (`SEARCH_SORT_PROFILE`), where All Tours keeps Locals' favorites. Every
 * filter, the date, the travellers and the sort live in the URL, so a result
 * page is shareable and survives a reload and the back button.
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
    // island's display name for the chip in the same pass - all independent
    // cached loaders, so they run together rather than serially.
    const [destinations, facets, categories, currency] = await Promise.all([
        destination ? getActiveDestinations(locale) : Promise.resolve(null),
        destination ? getDestinationFacets(destination) : Promise.resolve(null),
        destination
            ? getDestinationCategories(destination, locale)
            : getActiveCategories(locale),
        getServerCurrency(locale),
    ]);
    const destinationName =
        destinations?.find(d => d.slug === destination)?.name ?? null;
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

    const results =
        query.length >= 2
            ? await searchTours({
                  q: query,
                  locale,
                  currency,
                  destinationSlug: destination,
                  page: filters.page,
                  limit: PAGE_SIZE,
                  categoryIds: categoryIds.length
                      ? categoryIds.join(',')
                      : undefined,
                  ...tourQuery,
                  // `filtersToTourQuery` returns a listing-safe sort; only this
                  // endpoint can honour "Most relevant".
                  sort: toBackendSort(filters.sort),
              })
            : null;

    const listings =
        results?.data.map(hit =>
            searchHitToListing(hit, locale, t, filters.date ?? undefined)
        ) ?? [];
    const total = results?.total ?? 0;
    const totalPages = results ? Math.max(1, Math.ceil(total / PAGE_SIZE)) : 0;

    // Dropping the island scope must not also throw away the term or anything
    // the toolbar has set, so the chip's href is the current URL minus
    // `destination` - not a rebuilt "q only" link.
    const withoutDestination = (() => {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(sp)) {
            if (key === 'destination') continue;
            const v = first(value);
            if (v) params.set(key, v);
        }
        const qs = params.toString();
        const path = localizeHref(locale, '/search');
        return qs ? `${path}?${qs}` : path;
    })();

    // Below the 2-character floor there is nothing to filter, so the toolbar
    // would only offer controls that cannot change anything.
    if (query.length < 2) {
        return (
            <div className='it-container'>
                <EmptyState title={t.promptTitle} hint={t.promptHint} />
            </div>
        );
    }

    return (
        <ToursBrowser
            header={
                <div className='it-container flex flex-col gap-2'>
                    {total > 0 && (
                        <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] text-it-heading/60'>
                            {(total === 1 ? t.resultFor : t.resultsFor)
                                .replace('{count}', String(total))
                                .replace('{query}', query)}
                        </p>
                    )}
                    {destinationName && (
                        <div className='flex flex-wrap items-center gap-2'>
                            <ScopeChip
                                href={withoutDestination}
                                label={destinationName}
                            />
                        </div>
                    )}
                </div>
            }
            toolbar={
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
            }
            results={
                total === 0 ? (
                    <EmptyState
                        title={t.noResults.replace('{query}', query)}
                        hint={t.noResultsHint}
                    />
                ) : (
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
            <p className='m-0 font-medium text-[18px] md:text-[22px] leading-[1.3] text-it-heading'>
                {title}
            </p>
            <p className='m-0 max-w-md text-[14px] md:text-[16px] leading-[1.6] text-it-heading/60'>
                {hint}
            </p>
        </div>
    );
}
