'use client';

import Image from 'next/image';
import { useState } from 'react';
import { Reveal } from './reveal';
import { TourCard } from './tour-card';
import type { TourCardDict, TourListing } from './tour-card';

/**
 * Paginated tour grid for the All Tours page — reuses the shared <TourCard>.
 * Matches Figma node 47167:4083 (3-col grid, gap-x 24 / gap-y 40) + the
 * centered pagination row beneath it (node 47167:4317).
 *
 * Pagination is currently presentational — page state is tracked locally; the
 * data fetch per page is wired when the trips API lands.
 */
export function ToursListing({
    tours,
    dict,
    pageCount,
}: {
    tours: TourListing[];
    dict: TourCardDict;
    pageCount: number;
}) {
    const [page, setPage] = useState(1);
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

    return (
        <Reveal className='flex flex-col gap-12 sm:gap-18'>
            {/* ── Tour grid ───────────────────────────────────────────────
                Mobile: 2-col grid of compact 177px cards (16px gaps) — the
                <TourCard> renders its compact variant automatically below a
                220px container width (Figma node 48540:16790).
                sm: 2-col with wider gaps · lg: 3-col (node 47167:4083). */}
            <div className='grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3'>
                {tours.map((tour) => (
                    <TourCard key={tour.id} tour={tour} dict={dict} />
                ))}
            </div>

            {/* ── Pagination ─────────────────────────────────────────────── */}
            {pageCount > 1 && (
                <nav
                    aria-label='Pagination'
                    className='flex items-center justify-center gap-5'>
                    <button
                        type='button'
                        aria-label='Previous page'
                        disabled={page === 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        className='inline-flex cursor-pointer items-center border-none bg-transparent p-0 transition-opacity disabled:cursor-not-allowed disabled:opacity-30'>
                        <Image
                            src='/icons/filters/pagination-arrow.svg'
                            alt=''
                            width={20}
                            height={20}
                            className='size-5 rotate-180'
                        />
                    </button>

                    {pages.map((n) => (
                        <button
                            key={n}
                            type='button'
                            aria-current={n === page ? 'page' : undefined}
                            onClick={() => setPage(n)}
                            className={`cursor-pointer border-none bg-transparent p-0 text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors ${
                                n === page
                                    ? 'text-it-heading'
                                    : 'text-it-heading/30 hover:text-it-heading'
                            }`}>
                            {n}
                        </button>
                    ))}

                    <button
                        type='button'
                        aria-label='Next page'
                        disabled={page === pageCount}
                        onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        className='inline-flex cursor-pointer items-center border-none bg-transparent p-0 transition-opacity disabled:cursor-not-allowed disabled:opacity-30'>
                        <Image
                            src='/icons/filters/pagination-arrow.svg'
                            alt=''
                            width={20}
                            height={20}
                            className='size-5'
                        />
                    </button>
                </nav>
            )}
        </Reveal>
    );
}

export type { TourCardDict, TourListing };
