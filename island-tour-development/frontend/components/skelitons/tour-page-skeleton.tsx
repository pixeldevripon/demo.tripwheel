import { cn } from '@/lib/utils';

/**
 * Loading skeletons for the tour detail page. Each export mirrors the layout of
 * the real section it stands in for (same containers, grid, and rough heights)
 * so the page streams in without layout shift and never goes blank while its
 * data loads. Used as `<Suspense fallback={...}>` for each independent fetch on
 * `components/frontend/tour-page.tsx`: detail (main), reviews preview, full
 * reviews, related tours.
 */

/** A single shimmering placeholder bar (frontend-tokened, no layout of its own). */
function Bar({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'animate-pulse rounded-md bg-it-heading/10',
                className,
            )}
        />
    );
}

/** Breadcrumb + header + gallery/booking + stacked content sections. */
export function TourDetailSkeleton() {
    return (
        <>
            {/* Breadcrumb */}
            <div className='it-container flex items-center gap-2 py-4'>
                <Bar className='h-3 w-16' />
                <Bar className='size-3 rounded-full' />
                <Bar className='h-3 w-20' />
                <Bar className='size-3 rounded-full' />
                <Bar className='h-3 w-40' />
            </div>

            {/* Header: title + meta row + action pills */}
            <div className='it-container flex flex-col gap-4 pb-6'>
                <Bar className='h-9 w-3/4 max-w-2xl md:h-11' />
                <div className='flex flex-wrap items-center gap-3'>
                    <Bar className='h-4 w-28' />
                    <Bar className='h-4 w-40' />
                    <div className='ml-auto flex gap-2'>
                        <Bar className='h-9 w-20 rounded-it-full' />
                        <Bar className='h-9 w-20 rounded-it-full' />
                    </div>
                </div>
            </div>

            {/* Gallery (left) + booking card (right rail) */}
            <section className='bg-it-white pb-16 md:pb-18'>
                <div className='it-container'>
                    <div className='flex flex-col gap-10 lg:grid lg:grid-cols-[792fr_384fr] lg:items-start lg:gap-6'>
                        <div className='grid h-80 grid-cols-4 grid-rows-2 gap-2 md:h-115'>
                            <Bar className='col-span-4 row-span-2 h-full md:col-span-2' />
                            <Bar className='hidden h-full md:block' />
                            <Bar className='hidden h-full md:block' />
                            <Bar className='hidden h-full md:block' />
                            <Bar className='hidden h-full md:block' />
                        </div>
                        <Bar className='h-105 w-full rounded-2xl' />
                    </div>
                </div>
            </section>

            {/* Detail sections: tab nav + stacked sections separated by hairlines */}
            <section className='bg-it-white pb-16 md:pb-24'>
                <div className='it-container'>
                    <div className='flex flex-col gap-10'>
                        <div className='flex gap-6 border-b border-it-heading/10 pb-4'>
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Bar key={i} className='h-5 w-24 shrink-0' />
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

/** Review preview strip (lives in the gallery column, below the gallery). */
export function TourReviewsPreviewSkeleton() {
    return (
        <div className='flex flex-col gap-4'>
            <Bar className='h-6 w-40' />
            <div className='grid gap-4 md:grid-cols-2'>
                <Bar className='h-28 w-full rounded-xl' />
                <Bar className='h-28 w-full rounded-xl' />
            </div>
        </div>
    );
}

/** Full reviews section (heading + rating histogram + review cards). */
export function TourReviewsSectionSkeleton() {
    return (
        <div className='flex flex-col gap-6'>
            <Bar className='h-7 w-48' />
            <div className='flex flex-col gap-2'>
                {Array.from({ length: 5 }).map((_, i) => (
                    <Bar key={i} className='h-4 w-full' />
                ))}
            </div>
            <div className='flex flex-col gap-4'>
                {Array.from({ length: 3 }).map((_, i) => (
                    <Bar key={i} className='h-24 w-full rounded-xl' />
                ))}
            </div>
        </div>
    );
}

/** Related-tours block: two heading + 3-card grids (mirrors TourRelatedSection). */
export function TourRelatedSkeleton() {
    return (
        <section className='it-section pt-0! bg-it-white'>
            <div className='it-container flex flex-col gap-16 md:gap-24'>
                {Array.from({ length: 2 }).map((_, g) => (
                    <div key={g} className='flex flex-col gap-6 md:gap-12'>
                        <Bar className='h-8 w-2/3 max-w-md md:h-10' />
                        <div className='grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3'>
                            {Array.from({ length: 3 }).map((_, i) => (
                                <div
                                    key={i}
                                    className='flex flex-col gap-3'>
                                    <Bar className='aspect-4/3 w-full rounded-xl' />
                                    <Bar className='h-4 w-3/4' />
                                    <Bar className='h-4 w-1/2' />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
