import { Bar } from './skeleton-bar';
import { TourCardSkeleton } from './tour-card-skeleton';

/**
 * Loading skeletons for the tour detail page. Each export mirrors the real
 * section it stands in for property-for-property (same containers, radius, grid,
 * gaps, and heights) so the page streams in with no layout shift and never goes
 * blank while its data loads. Used as `<Suspense fallback={...}>` for each
 * independent fetch on `components/frontend/tour/tour-page.tsx`: detail (main),
 * reviews preview, full reviews, related tours.
 */

/** How many review cards the full reviews block seeds server-side (REVIEWS_PAGE_SIZE). */
const REVIEWS_PAGE_SIZE = 10;

/** Breadcrumb + header + gallery/booking + stacked content sections. */
export function TourDetailSkeleton() {
    return (
        <>
            {/* Breadcrumb (mirrors ToursBreadcrumb: full-bleed row + hairline). */}
            <section className='bg-it-white'>
                <div className='mx-auto w-full max-w-[1440px]'>
                    <nav
                        aria-hidden='true'
                        className='flex items-center gap-2 px-4 py-5 md:px-8 xl:px-30'>
                        <Bar className='h-3.5 w-12' />
                        <Bar className='size-4 rounded-full' />
                        <Bar className='h-3.5 w-20' />
                        <Bar className='size-4 rounded-full' />
                        <Bar className='h-3.5 w-40' />
                    </nav>
                </div>
                <div className='h-px w-full bg-it-heading/10' />
            </section>

            {/* Header: title + meta (left) and action buttons (right on md). */}
            <section className='bg-it-white'>
                <div className='it-container'>
                    <div className='flex flex-col gap-5 py-5 md:flex-row md:items-start md:justify-between md:gap-8'>
                        <div className='flex flex-col gap-2'>
                            <Bar className='h-8 w-3/4 max-w-2xl md:h-14' />
                            <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
                                <Bar className='h-4 w-28' />
                                <Bar className='h-4 w-40' />
                            </div>
                        </div>
                        <div className='flex shrink-0 items-center gap-6'>
                            <div className='flex items-center gap-2'>
                                <Bar className='size-6 rounded-md' />
                                <Bar className='h-5 w-12' />
                            </div>
                            <div className='flex items-center gap-2'>
                                <Bar className='size-6 rounded-md' />
                                <Bar className='h-5 w-14' />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Gallery (left) + booking card (right rail). */}
            <section className='bg-it-white pb-16 md:pb-18'>
                <div className='it-container'>
                    <div className='flex flex-col gap-10 lg:grid lg:grid-cols-[792fr_384fr] lg:items-start lg:gap-6'>
                        {/* Left column = gallery + reviews preview (mirrors the real
                            `flex flex-col gap-10` left cell). */}
                        <div className='flex flex-col gap-10'>
                            <TourGallerySkeleton />
                            <TourReviewsPreviewSkeleton />
                        </div>
                        {/* Right rail = booking card. */}
                        <div className='lg:sticky lg:top-24'>
                            <TourBookingCardSkeleton />
                        </div>
                    </div>
                </div>
            </section>

            {/* Detail sections: tab nav + stacked sections separated by hairlines. */}
            <section className='bg-it-white pb-16 md:pb-24'>
                <div className='it-container'>
                    <div className='flex flex-col gap-10'>
                        {/* Tab nav (mirrors TourDetailTabs: underline bar, 7 tabs). */}
                        <div className='flex overflow-x-auto border-b border-it-heading/10'>
                            {Array.from({ length: 7 }).map((_, i) => (
                                <div
                                    key={i}
                                    className='-mb-px shrink-0 border-b-2 border-transparent px-5 py-4 md:px-7.5 md:py-5'>
                                    <Bar className='h-6 w-20 md:h-8 md:w-24' />
                                </div>
                            ))}
                        </div>
                        <div className='flex max-w-178.5 flex-col gap-10'>
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className='flex flex-col gap-4'>
                                    <Bar className='h-6 w-48' />
                                    <Bar className='h-4 w-full' />
                                    <Bar className='h-4 w-11/12' />
                                    <Bar className='h-4 w-4/5' />
                                    {i < 3 && (
                                        <div className='mt-6 h-px w-full bg-it-heading/10' />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </section>
        </>
    );
}

/** Gallery collage + meta strip (mirrors TourGallery). */
function TourGallerySkeleton() {
    return (
        <div className='flex flex-col gap-6'>
            {/* Mobile: single tile. */}
            <Bar className='aspect-396/300 w-full rounded-it-lg lg:hidden' />
            {/* Desktop: 5-tile collage (big tile + 2x2). */}
            <div className='hidden overflow-hidden rounded-it-lg lg:grid lg:grid-cols-[2fr_1fr_1fr] lg:grid-rows-[175px_175px] lg:gap-2.5'>
                <Bar className='h-full w-full rounded-[16px] lg:row-span-2' />
                <Bar className='h-full w-full rounded-[16px]' />
                <Bar className='h-full w-full rounded-[16px]' />
                <Bar className='h-full w-full rounded-[16px]' />
                <Bar className='h-full w-full rounded-[16px]' />
            </div>
            {/* Meta strip: duration / pickup / languages between hairlines. */}
            <div className='flex flex-col gap-2'>
                <div className='h-px w-full bg-it-heading/10' />
                <div className='flex flex-wrap items-center gap-x-10 gap-y-2 py-1.5'>
                    {Array.from({ length: 3 }).map((_, i) => (
                        <span key={i} className='flex items-center gap-2'>
                            <Bar className='size-6 rounded-md' />
                            <Bar className='h-5 w-24' />
                        </span>
                    ))}
                </div>
                <div className='h-px w-full bg-it-heading/10' />
            </div>
        </div>
    );
}

/** Booking rail: main card (price + date + slots + summary + CTA) + sell-out notice. */
function TourBookingCardSkeleton() {
    return (
        <div className='flex flex-col gap-4'>
            {/* Main booking card. */}
            <div className='overflow-hidden rounded-[16px] bg-it-surface'>
                {/* Price header. */}
                <div className='border-b border-it-heading/10 px-4 py-4'>
                    <Bar className='h-8 w-44' />
                </div>
                {/* Content: selectors + CTA. */}
                <div className='flex flex-col gap-6 p-4'>
                    <div className='flex flex-col gap-2.5'>
                        {/* Date field. */}
                        <div className='flex items-center justify-between rounded-[8px] bg-it-white px-4 py-4'>
                            <Bar className='h-5 w-24' />
                            <Bar className='size-6 rounded-md' />
                        </div>
                        {/* Time slots. */}
                        <div className='grid grid-cols-3 gap-2'>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div
                                    key={i}
                                    className='flex flex-col items-center gap-[3px] rounded-[8px] border border-transparent bg-it-white px-4 py-2'>
                                    <Bar className='h-6 w-14' />
                                    <Bar className='h-4 w-12' />
                                </div>
                            ))}
                        </div>
                        {/* Traveler + price summary. */}
                        <div className='flex flex-col gap-5 rounded-[8px] bg-it-white p-4'>
                            <div className='flex flex-col gap-3.5'>
                                <div className='flex items-center justify-between'>
                                    <Bar className='h-5 w-28' />
                                    <Bar className='size-5 rounded-md' />
                                </div>
                                <div className='h-px w-full bg-it-heading/10' />
                                <div className='flex items-center justify-between'>
                                    <Bar className='h-4 w-32' />
                                    <Bar className='h-4 w-12' />
                                </div>
                                <div className='h-px w-full bg-it-heading/10' />
                                <div className='flex flex-col gap-2'>
                                    <div className='flex items-center justify-between'>
                                        <Bar className='h-4 w-16' />
                                        <Bar className='h-4 w-12' />
                                    </div>
                                    <div className='flex items-center justify-between'>
                                        <Bar className='h-4 w-24' />
                                        <Bar className='h-4 w-12' />
                                    </div>
                                    <div className='flex items-center justify-between'>
                                        <Bar className='h-4 w-28' />
                                        <Bar className='h-4 w-12' />
                                    </div>
                                    <Bar className='h-4 w-28' />
                                </div>
                            </div>
                            <Bar className='h-5 w-24 self-center' />
                        </div>
                    </div>
                    {/* CTA + trust lines. */}
                    <div className='flex flex-col gap-5'>
                        <Bar className='h-14 w-full rounded-it-full' />
                        <div className='flex flex-col gap-2'>
                            <Bar className='h-5 w-3/4' />
                            <Bar className='h-5 w-2/3' />
                        </div>
                    </div>
                </div>
            </div>
            {/* "Likely to sell out" notice. */}
            <div className='flex items-start gap-1 rounded-[16px] bg-it-surface p-4'>
                <Bar className='size-6 shrink-0 rounded-md' />
                <div className='flex flex-col gap-1'>
                    <Bar className='h-5 w-40' />
                    <Bar className='h-4 w-56 max-w-full' />
                </div>
            </div>
        </div>
    );
}

/** Review preview strip (lives in the gallery column, below the gallery). */
export function TourReviewsPreviewSkeleton() {
    return (
        <section className='flex flex-col gap-6'>
            {/* Header: title + rating (left) / see-all (right), then subtitle. */}
            <div className='flex flex-col gap-2'>
                <div className='flex flex-wrap items-center justify-between gap-x-4 gap-y-2'>
                    <div className='flex items-center gap-4'>
                        <Bar className='h-7 w-40' />
                        <Bar className='h-5 w-24' />
                    </div>
                    <Bar className='h-5 w-20' />
                </div>
                <Bar className='h-4 w-2/3 max-w-md' />
            </div>
            {/* Two preview cards inside the paper panel (design v2 .rpreview). */}
            <div className='grid gap-3 md:grid-cols-2'>
                <Bar className='h-[110px] w-full' />
                <Bar className='h-[110px] w-full' />
            </div>
        </section>
    );
}

/** Full reviews section (heading + rating summary + histogram + sort + cards). */
export function TourReviewsSectionSkeleton({
    count = REVIEWS_PAGE_SIZE,
}: {
    /** Cards to reserve - pass `min(REVIEWS_PAGE_SIZE, reviewCount)` for an exact fit. */
    count?: number;
}) {
    return (
        <section className='flex flex-col gap-8'>
            {/* Header + rating summary. */}
            <div className='flex flex-col gap-4'>
                <div className='flex flex-col gap-2'>
                    <Bar className='h-6 w-48' />
                    <Bar className='h-4 w-2/3 max-w-md' />
                </div>
                <div className='flex flex-col gap-8'>
                    {/* Rating summary row (star + rating + count). */}
                    <div className='flex items-center gap-4'>
                        <Bar className='h-5 w-16' />
                        <Bar className='h-5 w-32' />
                    </div>
                    {/* Histogram (max-w-91, 5 thin rows). */}
                    <div className='flex max-w-91 flex-col gap-1'>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className='flex items-center gap-3'>
                                <Bar className='h-5 w-9 shrink-0' />
                                <Bar className='h-2 flex-1 rounded-it-full' />
                                <Bar className='h-5 w-6 shrink-0' />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
            {/* Sort control (label + select pill). */}
            <div className='flex items-center gap-8'>
                <Bar className='h-5 w-16' />
                <Bar className='h-10 w-40 rounded-it-full' />
            </div>
            {/* Review cards (rounded-[16px], stacked). */}
            <div className='flex flex-col gap-4'>
                {Array.from({ length: count }).map((_, i) => (
                    <Bar key={i} className='h-40 w-full rounded-[16px]' />
                ))}
            </div>
        </section>
    );
}

/** Related-tours block: two heading + 3-card grids (mirrors TourRelatedTours,
 *  which renders INSIDE the detail column - plain block, no own container). */
export function TourRelatedSkeleton() {
    return (
        <div className='flex flex-col gap-8 pt-2.5'>
            {Array.from({ length: 2 }).map((_, g) => (
                <div key={g} className='flex flex-col gap-3.5'>
                    <Bar className='h-6 w-2/3 max-w-sm' />
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4'>
                        {Array.from({ length: 3 }).map((_, i) => (
                            <TourCardSkeleton
                                key={i}
                                className='max-sm:aspect-auto max-sm:h-[170px]'
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
