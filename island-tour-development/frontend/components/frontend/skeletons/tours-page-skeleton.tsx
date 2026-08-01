import { Bar, PaginationSkeleton } from './skeleton-bar';
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
                <Bar className='h-3.5 w-12 rounded-it-xs' />
                <Bar className='h-3.5 w-20 rounded-it-xs' />
                <Bar className='h-3.5 w-24 rounded-it-xs' />
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
 * Filter row + grid head (mirrors the v2 ToursFilterBar): the full-width
 * hairline band of chip bars, then the counter line in the container.
 */
export function ToursToolbarSkeleton() {
    return (
        <>
            <div className='mt-3.5 border-b border-it-divider py-3'>
                <div className='it-container flex items-center gap-2.5 overflow-hidden'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Bar
                            key={i}
                            className='h-[39px] w-24 shrink-0 rounded-it-full'
                        />
                    ))}
                    <span
                        className='mx-1 h-[38px] w-px shrink-0 bg-it-border'
                        aria-hidden='true'
                    />
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Bar
                            key={i}
                            className='h-[39px] w-28 shrink-0 rounded-it-full max-sm:hidden'
                        />
                    ))}
                    <Bar className='ml-auto hidden h-[21px] w-40 shrink-0 rounded-it-xs lg:block' />
                </div>
            </div>
            <div className='it-container pt-[18px] pb-3.5'>
                <Bar className='h-[22px] w-28 rounded-it-xs' />
            </div>
        </>
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
                <div className='grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-5 lg:grid-cols-4'>
                    {Array.from({ length: 8 }).map((_, i) => (
                        <TourCardSkeleton
                            key={i}
                            className='max-sm:aspect-auto max-sm:h-[170px]'
                        />
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

/** Trust strip - four icon + two-line items (mirrors ToursTrustStrip). */
export function ToursTrustStripSkeleton() {
    return (
        <section className='bg-it-bg'>
            <div className='it-container'>
                <div className='grid grid-cols-2 gap-x-4 gap-y-4 py-7 md:flex md:items-center md:justify-between md:gap-x-6'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className='flex items-start gap-3'>
                            <Bar className='size-5 shrink-0 rounded-md [--it-skeleton-bg:var(--it-white)]' />
                            <Bar className='h-5 w-28 [--it-skeleton-bg:var(--it-white)]' />
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
            <section className='bg-it-white pb-8 md:pb-14'>
                <div className='it-container'>
                    <ToursHeaderSkeleton />
                </div>
                <ToursListingSkeleton />
            </section>
            <ToursTrustStripSkeleton />
        </>
    );
}
