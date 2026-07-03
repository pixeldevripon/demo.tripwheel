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

/**
 * Neutral initial-load skeleton for the polymorphic `[slug]` route
 * (category | hub | tour). Rendered by that route's `loading.tsx` while the page
 * resolves the slug registry + dictionary + destination name - i.e. before the
 * entity component mounts and streams its own section skeletons. Kept generic
 * (breadcrumb + header + hero + card grid, sharing the same top as the tour
 * skeleton) so the handoff reads cleanly for every entity type instead of a blank.
 */
export function EntityPageSkeleton() {
    return (
        <>
            {/* Breadcrumb */}
            <div className='it-container flex items-center gap-2 py-4'>
                <Bar className='h-3 w-16' />
                <Bar className='size-3 rounded-full' />
                <Bar className='h-3 w-24' />
                <Bar className='size-3 rounded-full' />
                <Bar className='h-3 w-40' />
            </div>

            {/* Header: title + a line of meta */}
            <div className='it-container flex flex-col gap-4 pb-8'>
                <Bar className='h-9 w-3/4 max-w-2xl md:h-11' />
                <Bar className='h-4 w-52' />
            </div>

            {/* Content: hero band + a responsive card grid */}
            <div className='it-container flex flex-col gap-10 pb-16'>
                <Bar className='h-80 w-full rounded-2xl md:h-115' />
                <div className='grid grid-cols-2 gap-x-4 gap-y-6 sm:gap-x-6 sm:gap-y-10 lg:grid-cols-3'>
                    {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className='flex flex-col gap-3'>
                            <Bar className='aspect-4/3 w-full rounded-xl' />
                            <Bar className='h-4 w-3/4' />
                            <Bar className='h-4 w-1/2' />
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
}
