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
            <section className='relative flex h-136.75 items-end justify-center bg-it-surface pb-12 md:h-150 md:items-center md:pb-0'>
                <div className='it-container flex w-full flex-col items-center gap-6'>
                    <Bar className='h-10 w-2/3 max-w-xl md:h-14' />
                    <Bar className='h-14 w-full max-w-3xl rounded-full' />
                    <div className='flex flex-wrap justify-center gap-3'>
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Bar key={i} className='h-8 w-28 rounded-it-full' />
                        ))}
                    </div>
                </div>
            </section>
            <section className='it-section bg-it-white'>
                <div className='it-container flex flex-col gap-6'>
                    <Bar className='h-7 w-56' />
                    <div className='flex gap-4 overflow-hidden'>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <div
                                key={i}
                                className='flex w-45 shrink-0 flex-col gap-2'>
                                <Bar className='h-32 w-full rounded-xl' />
                                <Bar className='h-4 w-3/4' />
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}

/** "Locals' favorites" grid (mirrors DestinationListings: heading + CTA + 6 cards). */
export function DestinationListingsSkeleton() {
    return (
        <section className='it-section bg-it-white'>
            <div className='it-container flex flex-col gap-12'>
                <div className='flex items-end justify-between gap-4'>
                    <div className='flex flex-col gap-3'>
                        <Bar className='h-8 w-64 md:h-10' />
                        <Bar className='h-4 w-80 max-w-full' />
                    </div>
                    <Bar className='hidden h-10 w-32 rounded-it-full md:block' />
                </div>
                <div className='grid grid-cols-2 gap-x-4 gap-y-4 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3'>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className='flex flex-col gap-3'>
                            <Bar className='aspect-4/3 w-full rounded-xl' />
                            <Bar className='h-4 w-3/4' />
                            <Bar className='h-4 w-1/2' />
                        </div>
                    ))}
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
