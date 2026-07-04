import { connection } from 'next/server';

import {
    type FilterCategory,
    ToursFilterBar,
} from '@/components/frontend/tours-filter-bar';
import { ToursListing } from '@/components/frontend/tours-listing';
import { EMPTY_FILTERS } from '@/components/frontend/tours-filter-modal';
import {
    getDestinationCategories,
    getDestinationTours,
} from '@/lib/api/public';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import {
    filtersToTourQuery,
    parseToursFilters,
} from '@/lib/tours/filters';
import { searchHitToListing } from '@/lib/tours/listing';

/**
 * Async, streamed listing of the All Tours page: the toolbar (filters / sort /
 * category pills) + the recommended-order, paginated, FILTERED tour grid. Marked
 * dynamic with `await connection()` so its `<Suspense>` skeleton streams under
 * Cache Components (the loaders stay cached). Filter + sort + page state all live
 * in the URL (`@/lib/tours/filters`); changing any of them re-renders this
 * section and streams the new result behind the same skeleton.
 */

// Tours per page; the backend paginates and returns the destination-wide total.
const TOURS_LIMIT = 12;

interface ListingSectionProps {
    destinationId: string;
    destination: string;
    locale: Locale;
    dict: Dictionary;
    /** Route search params (forwarded unresolved so the shell stays prerendered). */
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function ToursListingSection({
    destinationId,
    destination,
    locale,
    dict,
    searchParams,
}: ListingSectionProps) {
    await connection();
    const filters = parseToursFilters(await searchParams);

    // Categories back both the quick-filter chips and the slug -> id resolution
    // for the `categoryIds` backend filter (multi-select). Cheap cached call.
    const categories = await getDestinationCategories(destination, locale);
    const categoryIds =
        filters.categories
            .map(slug => categories.find(c => c.slug === slug)?.id)
            .filter((id): id is string => Boolean(id))
            .join(',') || undefined;

    const query = filtersToTourQuery(filters);
    const fetchPage = (p: number) =>
        getDestinationTours({
            destinationId,
            locale,
            limit: TOURS_LIMIT,
            page: p,
            categoryIds,
            ...query,
        });

    let page = filters.page;
    let tourList = await fetchPage(page);
    const total = tourList.total;
    const pageCount = Math.max(1, Math.ceil(total / TOURS_LIMIT));

    // Out-of-range page (e.g. a hand-edited `?page=99`, or a page that no longer
    // exists after tightening a filter): clamp to the last page and refetch.
    if (page > pageCount) {
        page = pageCount;
        tourList = await fetchPage(page);
    }

    // Cards keep the backend order; searchHitToListing carries the badge + flat URL.
    const tours = tourList.data.map(hit =>
        searchHitToListing(hit, locale, dict.search),
    );

    // Real category quick-filter pills (tour-gated, so each links somewhere live).
    const filterCategories: FilterCategory[] = categories.map(category => ({
        label: category.name,
        slug: category.slug,
    }));

    return (
        <div className='flex flex-col gap-8'>
            <ToursFilterBar
                dict={dict.destination.allTours.toolbar}
                sortDict={dict.destination.allTours.sort}
                filterDict={dict.destination.allTours.filterModal}
                hasReviews
                categories={filterCategories}
                shown={tours?.length}
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

            <ToursListing
                tours={tours}
                dict={dict.destination.listings}
                pageCount={pageCount}
                currentPage={page}
            />
        </div>
    );
}
