import { cn } from '@/lib/utils';
import { Bar } from './skeleton-bar';

/**
 * Loading skeleton that EXACTLY mirrors the collection grid card
 * (`CollectionCard` in `components/frontend/collection-card.tsx`). Shares the
 * standard tour card's image + wrapper box, but its info block has no
 * price/duration rows: an invisible spacer where the star row would be, a
 * two-line title, and an "explore →" indicator.
 *
 * Matched to the real card: `@container` root
 * `rounded-[16px]` → `@[220px]:rounded-[24px]`, image `aspect-[86/74]` →
 * `@[220px]:aspect-[64/45]`, info `gap-1 pt-3 pb-1` →
 * `@[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5`, spacer row `h-4` →
 * `@[220px]:h-[22px]`.
 */
export function CollectionCardSkeleton({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                '@container flex flex-col overflow-hidden rounded-[16px] @[220px]:rounded-[24px]',
                className,
            )}>
            {/* Image area - identical box to the standard tour card. */}
            <div className='relative aspect-[86/74] w-full shrink-0 @[220px]:aspect-[64/45]'>
                <Bar className='absolute inset-0 rounded-none' />
            </div>

            {/* Info block - spacer row + title + explore indicator. */}
            <div className='flex flex-col gap-1 pt-3 pb-1 @[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5'>
                {/* Invisible spacer where the star row sits on the tour card. */}
                <div className='h-4 @[220px]:h-[22px]' aria-hidden='true' />
                {/* Title - up to two lines (larger type than the tour card). */}
                <div className='flex flex-col gap-1'>
                    <Bar className='h-3.5 w-full @[220px]:h-[18px]' />
                    <Bar className='h-3.5 w-2/3 @[220px]:h-[18px]' />
                </div>
                {/* Explore indicator (label + arrow). */}
                <div className='mt-1 flex items-center gap-1'>
                    <Bar className='h-3 w-20 @[220px]:h-3.5 @[220px]:w-24' />
                    <Bar className='size-3 rounded-full @[220px]:size-4' />
                </div>
            </div>
        </div>
    );
}
