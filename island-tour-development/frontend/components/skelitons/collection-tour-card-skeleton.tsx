import { cn } from '@/lib/utils';
import { Bar } from './skeleton-bar';

/**
 * Loading skeleton that EXACTLY mirrors the ranked collection tour card
 * (`RankedTourCard` in `components/frontend/tour-card.tsx`, rendered by
 * `collection-tours-section.tsx`). Distinct from `TourCardSkeleton`: a
 * `#f8f8f8` surface, a `aspect-[384/270]` image with a numbered rank badge, and
 * a horizontally-inset info block.
 *
 * Matched to the real card: root
 * `gap-3 rounded-[16px] pb-3` → `@[220px]:gap-4 @[220px]:rounded-[24px] @[220px]:pb-4`,
 * info `gap-2 px-2.5` → `@[220px]:gap-3 @[220px]:px-4`.
 */
export function CollectionTourCardSkeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                '@container flex flex-col gap-3 overflow-hidden rounded-[16px] bg-[#f8f8f8] pb-3 @[220px]:gap-4 @[220px]:rounded-[24px] @[220px]:pb-4',
                className,
            )}>
            {/* Image + rank badge (top-left). */}
            <div className='relative aspect-[384/270] w-full shrink-0'>
                <Bar className='absolute inset-0 rounded-none' />
                <div className='absolute left-2.5 top-2.5 size-8 rounded-it-full bg-it-heading/15 @[220px]:left-4 @[220px]:top-4 @[220px]:size-10' />
            </div>

            {/* Info - same inset + gaps as the real card. */}
            <div className='flex flex-col gap-2 px-2.5 @[220px]:gap-3 @[220px]:px-4'>
                {/* Rating. */}
                <Bar className='h-3.5 w-24 @[220px]:h-4 @[220px]:w-28' />

                <div className='flex flex-col gap-1 @[220px]:gap-1.5'>
                    {/* Title + description. */}
                    <div className='flex flex-col gap-1 @[220px]:gap-1.5'>
                        <Bar className='h-3.5 w-3/4 @[220px]:h-4' />
                        <Bar className='h-3 w-full @[220px]:h-3.5' />
                        <Bar className='h-3 w-5/6 @[220px]:h-3.5' />
                    </div>
                    {/* Duration · From $price. */}
                    <Bar className='h-3.5 w-32 @[220px]:h-4 @[220px]:w-40' />
                    {/* Free cancellation. */}
                    <Bar className='h-3 w-28 @[220px]:h-3.5 @[220px]:w-36' />
                </div>
            </div>
        </div>
    );
}
