'use client';

import { useToursNavOptional } from '@/components/frontend/tours/tours-browser';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { MountReveal } from '../mount-reveal';
import { Pagination } from '../pagination';
import { Reveal } from '../reveal';
import type { TourCardDict, TourListing } from '../tour-card';
import { TourCard } from '../tour-card';
import { ToursEmptyState, type ToursEmptyStateDict } from './tours-empty-state';

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
    peachFirst = false,
}: {
    tours: TourListing[];
    dict: TourCardDict;
    pageCount: number;
    /** Active 1-based page. When provided, pagination navigates via `?page=`. */
    currentPage?: number;
    /** Empty-filtering-result copy. When provided, a zero-result grid shows it. */
    emptyState?: ToursEmptyStateDict;
    /**
     * Peach tint (master §B.63): tints card #1 (page 1 only). The caller gates
     * it to the All Tours page under the DEFAULT sort - price sorts drop it,
     * and category/search/hub/collection listings never pass it.
     */
    peachFirst?: boolean;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const nav = useToursNavOptional();
    const [localPage, setLocalPage] = useState(1);

    const isUrlDriven = currentPage !== undefined;
    const page = currentPage ?? localPage;

    function goToPage(next: number) {
        if (!isUrlDriven) {
            setLocalPage(next);
            return;
        }
        // Preserve the current filter query and only swap `page` (page 1 drops
        // the param to keep the URL canonical). Route through the shared nav
        // transition when present so the grid dims non-blockingly instead of
        // freezing; fall back to a plain push outside a <ToursBrowser>.
        const params = new URLSearchParams(window.location.search);
        if (next <= 1) params.delete('page');
        else params.set('page', String(next));
        const qs = params.toString();
        const href = qs ? `${pathname}?${qs}` : pathname;
        if (nav) {
            nav.startNav(() => router.push(href));
        } else {
            router.push(href);
        }
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
                Sitewide tour grid: 2-col mobile (compact cards - <TourCard>
                switches variants below a 220px container width, Figma node
                48540:16790), 3-col from sm with wider gaps, 4-col from lg. */}
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-4'>
                {tours.map((tour, i) => (
                    <MountReveal key={tour.id} listItem>
                        <TourCard
                            tour={tour}
                            dict={dict}
                            tinted={peachFirst && page === 1 && i === 0}
                            // First card of the list renders pre-highlighted
                            // (static hover treatment - top placement marker).
                            highlighted={page === 1 && i === 0}
                        />
                    </MountReveal>
                ))}
            </div>

            {/* ── Pagination ─────────────────────────────────────────────── */}
            <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={goToPage}
            />
        </Reveal>
    );
}

export type { TourCardDict, TourListing };

