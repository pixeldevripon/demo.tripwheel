import { connection } from 'next/server';

import {
    type FilterCategory,
    ToursFilterBar,
} from '@/components/frontend/tours-filter-bar';
import { ToursHeader } from '@/components/frontend/tours-header';
import { ToursListing } from '@/components/frontend/tours-listing';
import {
    getDestinationCategories,
    getDestinationTours,
} from '@/lib/api/public';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { searchHitToListing } from '@/lib/tours/listing';

/**
 * Async, streamed sections of the All Tours page. The route resolves the island
 * (name / id) + dictionary and passes them in; each section here does its own
 * tour fetch and is marked dynamic with `await connection()` so its `<Suspense>`
 * skeleton actually streams under Cache Components (the data loaders themselves
 * stay cached, so the fetch is still fast).
 */

// All bookable tours for the destination; the grid paginates client-side.
const TOURS_LIMIT = 12;

interface HeaderSectionProps {
    destinationId: string;
    destinationName: string;
    dict: Dictionary;
}

/**
 * Title + subtitle + live count line. The count is the destination-wide LIVE
 * total, read cheaply with a `limit: 1` call (the row data is discarded).
 */
export async function ToursHeaderSection({
    destinationId,
    destinationName,
    dict,
}: HeaderSectionProps) {
    await connection();
    const { total } = await getDestinationTours({ destinationId, limit: 1 });

    return (
        <ToursHeader
            dict={dict.destination.allTours.heading}
            destinationName={destinationName}
            total={total}
            selectDateLabel={dict.destination.allTours.toolbar.selectDate}
        />
    );
}

interface ListingSectionProps {
    destinationId: string;
    destination: string;
    locale: Locale;
    dict: Dictionary;
}

/**
 * Toolbar (filters / sort / category pills) + the recommended-order tour grid.
 * `recommended` applies the master §7.2 order (tier_rank ASC, quality_score DESC,
 * id) + the §3.8 diversity pass + bookability filter, server-side.
 */
export async function ToursListingSection({
    destinationId,
    destination,
    locale,
    dict,
}: ListingSectionProps) {
    await connection();
    const [tourList, categories] = await Promise.all([
        getDestinationTours({
            destinationId,
            locale,
            sort: 'recommended',
            limit: TOURS_LIMIT,
        }),
        getDestinationCategories(destination, locale),
    ]);

    // Cards keep the backend order; searchHitToListing carries the badge + flat URL.
    const tours = tourList.data.map(hit =>
        searchHitToListing(hit, locale, dict.search),
    );
    const total = tourList.total;

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
                pageCount={1}
            />
        </div>
    );
}
