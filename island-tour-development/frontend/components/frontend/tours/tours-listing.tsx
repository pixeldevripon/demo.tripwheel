'use client';

import { useToursNavOptional } from '@/components/frontend/tours/tours-browser';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
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
    const searchParams = useSearchParams();
    const nav = useToursNavOptional();
    const [localPage, setLocalPage] = useState(1);

    const isUrlDriven = currentPage !== undefined;
    const page = currentPage ?? localPage;

    /**
     * Preserve the current filter query and only swap `page` (page 1 drops the
     * param to keep the URL canonical).
     *
     * Reads `useSearchParams()` rather than `window.location.search` so the URL
     * also resolves during SSR - the pagination renders these as real `href`s,
     * and a value only available in the browser would have emitted anchors with
     * nothing in them for a crawler to follow.
     */
    function hrefForPage(next: number): string {
        const params = new URLSearchParams(searchParams.toString());
        if (next <= 1) params.delete('page');
        else params.set('page', String(next));
        const qs = params.toString();
        return qs ? `${pathname}?${qs}` : pathname;
    }

    function goToPage(next: number) {
        if (!isUrlDriven) {
            setLocalPage(next);
            return;
        }
        // Route through the shared nav transition when present so the grid dims
        // non-blockingly instead of freezing; fall back to a plain push outside
        // a <ToursBrowser>.
        const href = hrefForPage(next);
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
        <Reveal className='flex flex-col gap-7.5'>
            {/* ── Tour grid ───────────────────────────────────────────────
                Design v2 catalog grid (.tcgrid, DIT-13): stacked row cards on
                mobile, 3-col from sm, 4-col from lg (20px row / 16px column
                gaps). */}
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5 lg:grid-cols-4'>
                {tours.map((tour, i) => (
                    <MountReveal key={tour.id} listItem>
                        <TourCard
                            tour={tour}
                            dict={dict}
                            mobileRow
                            tinted={peachFirst && page === 1 && i === 0}
                            // Peach top placement is sanctioned on All Tours
                            // only (§B.63) - category pages render card #1
                            // flat, so the highlight rides the same gate.
                            highlighted={peachFirst && page === 1 && i === 0}
                            // First ROW only (4 at lg, the widest layout) - the
                            // LCP candidate lives here. Preloading the whole
                            // page of cards just delays it.
                            priority={i < 4}
                        />
                    </MountReveal>
                ))}
            </div>

            {/* ── Pagination ─────────────────────────────────────────────── */}
            <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={goToPage}
                // Only the URL-driven mode has a real URL to point at; the
                // local-state grid stays on buttons.
                hrefFor={isUrlDriven ? hrefForPage : undefined}
            />
        </Reveal>
    );
}

export type { TourCardDict, TourListing };

