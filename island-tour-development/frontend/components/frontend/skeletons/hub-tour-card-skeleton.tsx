import { cn } from '@/lib/utils';
import { Bar } from './skeleton-bar';

/**
 * Loading skeleton that EXACTLY mirrors `HubTourCard`
 * (`components/frontend/hub-tour-card.tsx`). Unlike the tour/collection cards it
 * uses `md:` breakpoints (not `@container`), a single image (no carousel), an
 * attribute-tag row, and smaller radii.
 *
 * Matched to the real card: root `rounded-[8px]` → `md:rounded-[16px]`, image
 * `aspect-177/148` → `md:aspect-384/270` (bottom corners always squared),
 * content `gap-1.5 px-3 pt-2 pb-3` → `md:gap-3 md:px-4 md:pt-4 md:pb-4` (the
 * inset is permanent on the real card). The save button is absolute, so it
 * does not affect layout height.
 */
export function HubTourCardSkeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                'flex flex-col overflow-hidden rounded-[8px] bg-it-white md:rounded-[16px]',
                className,
            )}>
            {/* Image - single photo + save button (top-right). */}
            <div className='relative aspect-177/148 w-full shrink-0 rounded-t-[8px] md:aspect-384/270 md:rounded-t-[16px]'>
                <Bar className='absolute inset-0 rounded-none' />
                <div className='absolute inset-0 flex items-start justify-end p-2.5 md:p-4'>
                    <div className='size-8 shrink-0 rounded-it-full bg-it-white/70 md:size-10' />
                </div>
            </div>

            {/* Content - same gaps + permanent inset as the real card. */}
            <div className='flex flex-col gap-1.5 px-3 pt-2 pb-3 md:gap-3 md:px-4 md:pt-4 md:pb-4'>
                {/* Rating. */}
                <Bar className='h-3 w-24 md:h-4 md:w-28' />
                {/* Title + attribute tags. */}
                <div className='flex flex-col gap-1 md:gap-1.5'>
                    <Bar className='h-3.5 w-3/4 md:h-4' />
                    <Bar className='h-3 w-2/3 md:h-4' />
                </div>
                {/* Price. */}
                <Bar className='h-3.5 w-28 md:h-4 md:w-36' />
                {/* Free cancellation. */}
                <Bar className='h-3 w-24 md:h-4 md:w-32' />
            </div>
        </div>
    );
}
