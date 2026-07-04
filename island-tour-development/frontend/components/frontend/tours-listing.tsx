'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Pagination } from './pagination';
import { Reveal } from './reveal';
import { TourCard } from './tour-card';
import type { TourCardDict, TourListing } from './tour-card';
import {
    ToursEmptyState,
    type ToursEmptyStateDict,
} from './tours-empty-state';

/**
 * Paginated tour grid for the All Tours page - reuses the shared <TourCard>.
 * Matches Figma node 47167:4083 (3-col grid, gap-x 24 / gap-y 40) + the
 * centered pagination row beneath it (node 47167:4317).
 *
 * Pagination has two modes:
 *   - URL-driven (pass `currentPage`): writes `?page=N` and the server refetches
 *     that page, so the grid + count reflect real backend data (All Tours page).
 *   - Local-state (omit `currentPage`): presentational only, for grids not yet
 *     wired to a paged API (e.g. the category page's placeholder set).
 */
export function ToursListing({
    tours,
    dict,
    pageCount,
    currentPage,
    emptyState,
}: {
    tours: TourListing[];
    dict: TourCardDict;
    pageCount: number;
    /** Active 1-based page. When provided, pagination navigates via `?page=`. */
    currentPage?: number;
    /** Empty-filtering-result copy. When provided, a zero-result grid shows it. */
    emptyState?: ToursEmptyStateDict;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [localPage, setLocalPage] = useState(1);

    const isUrlDriven = currentPage !== undefined;
    const page = currentPage ?? localPage;

    function goToPage(next: number) {
        if (!isUrlDriven) {
            setLocalPage(next);
            return;
        }
        // Page 1 drops the param to keep the canonical URL clean. (Filters are
        // not yet in the URL, so we rebuild from the pathname rather than reading
        // useSearchParams - which would force a Suspense boundary on every
        // consumer, including the category page.)
        router.push(next <= 1 ? pathname : `${pathname}?page=${next}`);
    }

    // Zero filtered results: show the reusable empty screen instead of a blank
    // grid + lone pagination. In URL-driven mode, offer a "clear all" that resets
    // to the bare pathname (drops every filter param).
    if (tours.length === 0 && emptyState) {
        return (
            <ToursEmptyState
                dict={emptyState}
                onClear={isUrlDriven ? () => router.push(pathname) : undefined}
            />
        );
    }

    return (
        <Reveal className='flex flex-col gap-12 sm:gap-18'>
            {/* ── Tour grid ───────────────────────────────────────────────
                Mobile: 2-col grid of compact 177px cards (16px gaps) - the
                <TourCard> renders its compact variant automatically below a
                220px container width (Figma node 48540:16790).
                sm: 2-col with wider gaps · lg: 3-col (node 47167:4083). */}
            <div className='grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3'>
                {tours.map((tour) => (
                    <TourCard key={tour.id} tour={tour} dict={dict} />
                ))}
            </div>

            {/* ── Pagination ─────────────────────────────────────────────── */}
            <Pagination page={page} pageCount={pageCount} onPageChange={goToPage} />
        </Reveal>
    );
}

export type { TourCardDict, TourListing };
