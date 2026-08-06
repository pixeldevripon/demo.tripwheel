import { cn } from '@/lib/utils';
import { Bar } from './skeleton-bar';

/**
 * Loading skeleton for the standard tour card - design v2 .tcskl: ONE solid
 * shimmering paper block per card (`aspect-ratio: 3/4.1`, 12px radius), never
 * a card mocked out of little text bars. The block matches the real card's
 * footprint so a streamed card lands in the same box with no layout shift.
 */
export function TourCardSkeleton({
    className,
    mobileRow = false,
}: {
    className?: string;
    /**
     * Mirrors `TourCard`'s prop of the same name: below `sm` the real card is a
     * 170px-tall horizontal row, not a 3:4.1 portrait. Set it wherever the real
     * listing sets it, or the placeholder is a tall block that collapses to a
     * short row the moment results arrive - the exact layout shift this
     * skeleton exists to prevent.
     */
    mobileRow?: boolean;
}) {
    return (
        <Bar
            className={cn(
                'aspect-[3/4.1] w-full',
                mobileRow && 'max-sm:aspect-auto max-sm:h-[170px]',
                className
            )}
        />
    );
}
