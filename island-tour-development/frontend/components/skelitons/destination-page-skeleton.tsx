import { cn } from '@/lib/utils';

/** A single shimmering placeholder bar (frontend-tokened). */
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

/** Hero band + "Explore by type" row (mirrors DestinationHero + DestinationExploreTypes). */
export function DestinationHeroSkeleton() {
    return (
        <>
            {/* Hero: heading group (title + subtitle) + search pill + activities line. */}
            <section className='relative flex h-136.75 items-end justify-center bg-it-surface pb-12 md:h-150 md:items-center md:pb-0'>
                <div className='it-container flex w-full justify-center'>
                    <div className='flex w-full max-w-170.75 flex-col items-center gap-10'>
                        <div className='flex w-full flex-col items-center gap-1'>
                            <Bar className='h-8 w-3/4 max-w-md md:h-10' />
                            <Bar className='h-5 w-2/3 max-w-sm md:h-6' />
                        </div>
                        <div className='flex w-full flex-col items-center gap-4'>
                            <Bar className='h-15 w-full rounded-it-full md:h-20' />
                            <Bar className='h-4 w-64 max-w-full' />
                        </div>
                    </div>
                </div>
            </section>
            {/* Explore by type: heading + row of square category cards. */}
            <section className='it-section bg-it-surface'>
                <div className='it-container flex flex-col gap-10 md:gap-12'>
                    <Bar className='h-8 w-56 md:h-10' />
                    <div className='flex gap-4 overflow-hidden md:gap-6'>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Bar
                                key={i}
                                className='size-40 shrink-0 rounded-[16px] md:size-45'
                            />
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}

/**
 * "Locals' favorites" section (mirrors DestinationListings): single heading, the
 * mobile-carousel / lg-grid of 6 cards, and the centered "Browse all" CTA that
 * floats on a divider line.
 */
export function DestinationListingsSkeleton() {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <div className='flex flex-col gap-12'>
                    <Bar className='h-7 w-56 max-w-full md:h-10' />

                    {/* Mobile: wide swipe cards. lg: 3-col grid. */}
                    <div className='flex gap-4 overflow-hidden px-4 lg:grid lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10 lg:px-0'>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <div
                                key={i}
                                className='flex w-[82vw] shrink-0 flex-col gap-3 min-[480px]:w-[64vw] sm:w-[42vw] lg:w-auto'>
                                <Bar className='aspect-4/3 w-full rounded-xl' />
                                <Bar className='h-4 w-3/4' />
                                <Bar className='h-4 w-1/2' />
                            </div>
                        ))}
                    </div>

                    {/* Browse-all CTA: pill floating on a horizontal divider. */}
                    <div className='relative mt-10 flex items-center justify-center py-1'>
                        <div
                            className='absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-it-border'
                            aria-hidden='true'
                        />
                        <div className='relative z-10 bg-it-white px-5 py-2.5'>
                            <Bar className='h-4 w-40 md:w-52' />
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

/** About editorial block (mirrors DestinationAbout: heading + prose lines). */
export function DestinationAboutSkeleton() {
    return (
        <section className='it-section pt-8! bg-it-surface border-b border-it-heading/5'>
            <div className='it-container flex flex-col gap-10 md:gap-12'>
                <Bar className='h-8 w-72 max-w-full md:h-10' />
                <div className='flex flex-col gap-3'>
                    <Bar className='h-4 w-full' />
                    <Bar className='h-4 w-11/12' />
                    <Bar className='h-4 w-4/5' />
                    <Bar className='h-4 w-10/12' />
                </div>
            </div>
        </section>
    );
}

/**
 * Full destination-page skeleton for the route's `loading.tsx` - composes the
 * section skeletons in page order so the initial load mirrors the real page and
 * hands off seamlessly to the per-section `<Suspense>` boundaries.
 */
export function DestinationPageSkeleton() {
    return (
        <>
            <DestinationHeroSkeleton />
            <DestinationListingsSkeleton />
            <DestinationAboutSkeleton />
        </>
    );
}
