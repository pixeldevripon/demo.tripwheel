import { connection } from 'next/server';

import {
    type FilterCategory,
    ToursFilterBar,
} from '@/components/frontend/tours-filter-bar';
import { ToursListing } from '@/components/frontend/tours-listing';
import {
    getDestinationCategories,
    getDestinationTours,
} from '@/lib/api/public';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { searchHitToListing } from '@/lib/tours/listing';

/**
 * Async, streamed listing of the All Tours page: the toolbar (filters / sort /
 * category pills) + the recommended-order, paginated tour grid. Marked dynamic
 * with `await connection()` so its `<Suspense>` skeleton streams under Cache
 * Components (the loaders stay cached). The active page comes from the URL
 * (`?page=N`); changing it re-renders this section and streams the new page
 * behind the same skeleton. `recommended` applies the master §7.2 order
 * (tier_rank ASC, quality_score DESC, id) + the §3.8 diversity pass +
 * bookability filter, server-side.
 */

// Tours per page; the backend paginates and returns the destination-wide total.
const TOURS_LIMIT = 12;

/** First valid page (1-based) from the raw `?page` query value. */
function parsePage(raw: string | string[] | undefined): number {
    const value = Array.isArray(raw) ? raw[0] : raw;
    const n = Number(value);
    return Number.isInteger(n) && n >= 1 ? n : 1;
}

interface ListingSectionProps {
    destinationId: string;
    destination: string;
    locale: Locale;
    dict: Dictionary;
    /** Route search params (forwarded unresolved so the shell stays prerendered). */
    searchParams: Promise<{ page?: string | string[] }>;
}

export async function ToursListingSection({
    destinationId,
    destination,
    locale,
    dict,
    searchParams,
}: ListingSectionProps) {
    await connection();
    const { page: pageParam } = await searchParams;
    let page = parsePage(pageParam);

    const fetchPage = (p: number) =>
        getDestinationTours({
            destinationId,
            locale,
            sort: 'recommended',
            limit: TOURS_LIMIT,
            page: p,
        });

    const [firstList, categories] = await Promise.all([
        fetchPage(page),
        getDestinationCategories(destination, locale),
    ]);

    let tourList = firstList;
    const total = tourList.total;
    const pageCount = Math.max(1, Math.ceil(total / TOURS_LIMIT));

    // Out-of-range page (e.g. a hand-edited `?page=99`): clamp to the last page
    // and refetch so the grid never shows empty while tours exist.
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
            {/* Filters/sort/date are still client-side UI only - the grid is the
                live recommended order. Wiring the filter state to query params is
                a separate task. */}
            <ToursFilterBar
                dict={dict.destination.allTours.toolbar}
                sortDict={dict.destination.allTours.sort}
                filterDict={dict.destination.allTours.filterModal}
                hasReviews
                categories={filterCategories}
                guestCount={2}
                shown={tours.length}
                total={total}
                initialSelected={[]}
                initialChips={[]}
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
