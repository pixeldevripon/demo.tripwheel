import { Bar, PaginationSkeleton, TOUR_CARD_GRID } from './skeleton-bar';
import { TourCardSkeleton } from './tour-card-skeleton';

/**
 * Loading skeletons for the tours listings (All Tours + Category page).
 * Each export mirrors the layout of the real section it stands in for (same
 * containers, spacing, and rough heights) so the page streams in without layout
 * shift and never goes blank while its data loads.
 *
 * - `ToursHeaderSkeleton`  -> stands in for the streamed header
 * - `ToursListingSkeleton` -> <Suspense> fallback for the filter row + grid
 * - `ToursPageSkeleton`    -> the route `loading.tsx` (full first-paint shell)
 */

/** Breadcrumb row - design v2 .crumbs inside the page-header container. */
export function ToursBreadcrumbSkeleton() {
    return (
        <div className='it-container'>
            <nav
                aria-hidden='true'
                className='flex items-center gap-2 pt-[26px] pb-2.5'>
                <Bar className='h-3.5 w-12' />
                <Bar className='h-3.5 w-20' />
                <Bar className='h-3.5 w-24' />
            </nav>
        </div>
    );
}

/** Title + orientation line + count (mirrors the v2 ToursHeader). */
export function ToursHeaderSkeleton() {
    return (
        <div className='flex flex-col'>
            <Bar className='h-8 w-3/4 max-w-md' />
            <Bar className='mt-2 h-4 w-full max-w-[640px]' />
            <Bar className='mt-1.5 h-3.5 w-24 rounded-it-xs' />
        </div>
    );
}

/**
 * Filter row + grid head (mirrors the v2 ToursFilterBar): ONE hairline band -
 * chip bars, then the counter line - because the real toolbar sticks as one
 * surface and the skeleton has to settle into it without a jump.
 */
export function ToursToolbarSkeleton() {
    return (
        <div className='mt-3.5 border-b border-it-divider py-3'>
            <div className='it-container flex items-center gap-2.5 overflow-hidden max-md:flex-wrap max-md:gap-y-2.5'>
                {/* Control strip - one line at every width. */}
                <div className='flex min-w-0 flex-1 items-center gap-2.5 overflow-hidden md:contents'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Bar
                            key={i}
                            className='h-[39px] w-24 shrink-0 rounded-it-full'
                        />
                    ))}
                </div>
                <span
                    className='mx-1 h-[38px] w-px shrink-0 bg-it-border max-md:hidden'
                    aria-hidden='true'
                />
                {/* Category track - its own line below md, so the skeleton
                    is the same two lines the real toolbar settles into. */}
                <div className='flex min-w-0 items-center gap-1.5 overflow-hidden max-md:w-full md:flex-1'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Bar
                            key={i}
                            className='h-[34px] w-28 shrink-0 rounded-it-full md:h-[39px]'
                        />
                    ))}
                </div>
            </div>
            {/* Grid head - counter left, Sort pinned right. */}
            <div className='it-container flex items-center gap-3 pt-3.5'>
                <Bar className='h-[22px] w-28 rounded-it-xs' />
                <Bar className='ml-auto h-[21px] w-40 shrink-0 rounded-it-xs' />
            </div>
        </div>
    );
}

/**
 * Tour grid (design v2 .tcskl): one solid block per card in the same
 * 1-col / 3-col / 4-col grid the real listing uses (row-height cards on
 * mobile), plus the pagination row beneath, so the listing streams in with
 * no vertical shift.
 */
export function ToursGridSkeleton() {
    return (
        <div className='it-container'>
            <div className='flex flex-col gap-7.5'>
                <div className={TOUR_CARD_GRID}>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <TourCardSkeleton key={i} mobileRow />
                    ))}
                </div>
                <PaginationSkeleton />
            </div>
        </div>
    );
}

/** Filter row + grid together - the <Suspense> fallback for the listing section. */
export function ToursListingSkeleton() {
    return (
        <>
            <ToursToolbarSkeleton />
            <ToursGridSkeleton />
        </>
    );
}

/**
 * Trust strip - four icon + two-line columns (mirrors ToursTrustStrip, which
 * follows Figma 47626:9337). It tracked the OLD shape (four tick lines and a
 * trailing WhatsApp link) and would have reflowed the band the moment the real
 * strip streamed in: the band is taller now and the link is gone.
 */
export function ToursTrustStripSkeleton() {
    return (
        <section className='mt-14 mb-20 bg-it-surface py-11'>
            <div className='it-container'>
                <div className='flex flex-wrap items-start gap-x-10 gap-y-7 md:flex-nowrap md:justify-between'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className='flex items-start gap-4'>
                            <Bar className='size-5 shrink-0 rounded-md md:size-6 [--it-skeleton-bg:var(--it-white)]' />
                            <div className='flex flex-col gap-1'>
                                <Bar className='h-[22px] w-32 [--it-skeleton-bg:var(--it-white)]' />
                                <Bar className='h-[22px] w-24 [--it-skeleton-bg:var(--it-white)]' />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/**
 * Full listing-page skeleton for the route's `loading.tsx` - composes the
 * section skeletons in page order (crumbs + header + filter row + grid + trust)
 * inside the same section shells as the real page, so the initial load mirrors
 * it and hands off seamlessly to the per-section <Suspense> boundaries.
 */
export function ToursPageSkeleton() {
    return (
        <>
            <ToursBreadcrumbSkeleton />
            {/* No bottom padding - matches the real page: the trust strip's
                own 56px top margin sets the gap below the pager. */}
            <section className='bg-it-white'>
                <div className='it-container'>
                    <ToursHeaderSkeleton />
                </div>
                <ToursListingSkeleton />
            </section>
            <ToursTrustStripSkeleton />
        </>
    );
}
