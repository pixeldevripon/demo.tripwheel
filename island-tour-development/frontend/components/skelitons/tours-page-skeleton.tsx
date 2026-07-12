import { Bar, CARD_GRID, GRID_PAGE_SIZE, PaginationSkeleton } from './skeleton-bar';
import { TourCardSkeleton } from './tour-card-skeleton';

/**
 * Loading skeletons for the All Tours page (`/[locale]/[destination]/tours`).
 * Each export mirrors the layout of the real section it stands in for (same
 * containers, spacing, and rough heights) so the page streams in without layout
 * shift and never goes blank while its data loads.
 *
 * - `ToursHeaderSkeleton`  -> <Suspense> fallback for the streamed header
 * - `ToursListingSkeleton` -> <Suspense> fallback for the streamed toolbar + grid
 * - `ToursPageSkeleton`    -> the route `loading.tsx` (full first-paint shell)
 */

/** Breadcrumb bar - `Home › Destination › current` + full-width hairline. */
export function ToursBreadcrumbSkeleton() {
    return (
        <section className='bg-it-white'>
            <div className='mx-auto w-full max-w-360'>
                <nav
                    aria-hidden='true'
                    className='flex items-center gap-2 px-4 py-5 md:px-8 xl:px-30'>
                    <Bar className='h-3.5 w-12' />
                    <Bar className='size-4 rounded-full' />
                    <Bar className='h-3.5 w-20' />
                    <Bar className='size-4 rounded-full' />
                    <Bar className='h-3.5 w-24' />
                </nav>
            </div>
            <div className='h-px w-full bg-it-heading/10' />
        </section>
    );
}

/** Title + subtitle + count line (mirrors ToursHeader). */
export function ToursHeaderSkeleton() {
    return (
        <div className='flex flex-col gap-4 md:gap-2'>
            <div className='flex flex-col gap-2 md:gap-1'>
                <Bar className='h-9 w-3/4 max-w-2xl md:h-12' />
                <Bar className='h-4 w-1/2 max-w-md' />
            </div>
            <div className='flex items-center justify-between gap-2'>
                <Bar className='h-5 w-40' />
                <Bar className='h-9.5 w-28 rounded-it-full md:hidden' />
            </div>
        </div>
    );
}

/** Toolbar (control + category pills, counter + sort) - mirrors ToursFilterBar. */
export function ToursToolbarSkeleton() {
    return (
        <div className='flex flex-col gap-6'>
            {/* Row 1 - control pills + category pills */}
            <div className='flex items-center gap-4 overflow-hidden'>
                <div className='flex shrink-0 items-center gap-2'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Bar
                            key={i}
                            className='h-9.5 w-24 shrink-0 rounded-it-full md:h-12.5 md:w-28'
                        />
                    ))}
                </div>
                <span className='h-8.5 w-px shrink-0 bg-it-heading/20' aria-hidden='true' />
                <div className='flex shrink-0 items-center gap-2'>
                    {Array.from({ length: 5 }).map((_, i) => (
                        <Bar
                            key={i}
                            className='h-9.5 w-20 shrink-0 rounded-it-full md:h-12.5 md:w-24'
                        />
                    ))}
                </div>
            </div>
            {/* Row 2 - result counter (left) + sort (right) */}
            <div className='flex items-center justify-between gap-3'>
                <Bar className='h-5 w-28' />
                <Bar className='hidden h-5 w-36 md:block' />
            </div>
        </div>
    );
}

/**
 * Tour grid (2-col / 3-col) - mirrors `ToursListing`: the `flex flex-col gap-12
 * sm:gap-18` wrapper, a full page of `TourCard`s (same grid), and the pagination
 * row beneath, so the listing streams in with no vertical shift.
 */
export function ToursGridSkeleton() {
    return (
        <div className='flex flex-col gap-12 sm:gap-18'>
            <div className={CARD_GRID}>
                {Array.from({ length: GRID_PAGE_SIZE }).map((_, i) => (
                    <TourCardSkeleton key={i} />
                ))}
            </div>
            <PaginationSkeleton />
        </div>
    );
}

/** Toolbar + grid together - the <Suspense> fallback for the listing section. */
export function ToursListingSkeleton() {
    return (
        <div className='flex flex-col gap-8'>
            <ToursToolbarSkeleton />
            <ToursGridSkeleton />
        </div>
    );
}

/** Trust strip - four icon + two-line items (mirrors ToursTrustStrip). */
export function ToursTrustStripSkeleton() {
    return (
        <section className='bg-it-surface'>
            <div className='it-container'>
                <div className='grid grid-cols-2 gap-x-4 gap-y-4 py-8 md:flex md:items-center md:justify-between md:gap-x-6 md:py-22.5'>
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className='flex items-start gap-3 md:gap-4'>
                            <Bar className='size-6 shrink-0 rounded-md' />
                            <div className='flex flex-col gap-1.5'>
                                <Bar className='h-4 w-28' />
                                <Bar className='h-4 w-20' />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}

/**
 * Full All-Tours page skeleton for the route's `loading.tsx` - composes the
 * section skeletons in page order (breadcrumb + header + toolbar + grid + trust)
 * inside the same section shells as the real page, so the initial load mirrors
 * it and hands off seamlessly to the per-section <Suspense> boundaries.
 */
export function ToursPageSkeleton() {
    return (
        <>
            <ToursBreadcrumbSkeleton />
            <section className='bg-it-white pb-8 md:pb-32.5'>
                <div className='it-container'>
                    <div className='flex flex-col max-md:gap-8 gap-10 pt-8 md:pt-15'>
                        <ToursHeaderSkeleton />
                        <div className='h-px w-full bg-it-heading/10' aria-hidden='true' />
                        <ToursListingSkeleton />
                    </div>
                </div>
            </section>
            <ToursTrustStripSkeleton />
        </>
    );
}
