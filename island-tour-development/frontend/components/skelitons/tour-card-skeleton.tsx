import { cn } from '@/lib/utils';
import { Bar } from './skeleton-bar';

/**
 * Loading skeleton that EXACTLY mirrors the standard tour card
 * (`DefaultTourCard` in `components/frontend/tour-card.tsx`) so a streamed card
 * lands in the same box with zero layout shift.
 *
 * Matched to the real card: `@container` root (compact <220px cell / full-size
 * wide cell), image `aspect-[86/74]` → `@[220px]:aspect-[64/45]`, wrapper
 * `rounded-[16px]` → `@[220px]:rounded-[24px]`, info block
 * `gap-1 pt-3 pb-1` → `@[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5`, and the
 * fixed-height rating row `h-4` → `@[220px]:h-[22px]` that keeps card heights
 * consistent. Hover-only affordances (carousel arrows, dots, the 16px hover
 * inset) are omitted - they do not occupy layout at rest.
 */
export function TourCardSkeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                '@container flex flex-col overflow-hidden rounded-[16px] @[220px]:rounded-[24px]',
                className,
            )}>
            {/* Image area - same aspect ratio switch as the real card. */}
            <div className='relative aspect-[86/74] w-full shrink-0 @[220px]:aspect-[64/45]'>
                <Bar className='absolute inset-0 rounded-none' />
            </div>

            {/* Info block - same gaps + paddings as the real card. */}
            <div className='flex flex-col gap-1 pt-3 pb-1 @[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5'>
                {/* Rating row - fixed height (matches the real card). */}
                <div className='flex items-center h-4 @[220px]:h-[22px]'>
                    <Bar className='h-3 w-20 @[220px]:h-3.5 @[220px]:w-28' />
                </div>
                {/* Title - up to two lines. */}
                <div className='flex flex-col gap-1'>
                    <Bar className='h-3 w-full @[220px]:h-4' />
                    <Bar className='h-3 w-3/4 @[220px]:h-4' />
                </div>
                {/* Duration · pickup row. */}
                <Bar className='h-3 w-24 @[220px]:h-4 @[220px]:w-32' />
                {/* Price row. */}
                <Bar className='h-3 w-20 @[220px]:h-4 @[220px]:w-24' />
                {/* Free-cancellation line. */}
                <Bar className='h-2.5 w-28 @[220px]:h-3.5 @[220px]:w-36' />
            </div>
        </div>
    );
}
