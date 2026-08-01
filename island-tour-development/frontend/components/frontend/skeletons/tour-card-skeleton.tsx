import { cn } from '@/lib/utils';
import { Bar } from './skeleton-bar';

/**
 * Loading skeleton for the standard tour card - design v2 .tcskl: ONE solid
 * shimmering paper block per card (`aspect-ratio: 3/4.1`, 12px radius), never
 * a card mocked out of little text bars. The block matches the real card's
 * footprint so a streamed card lands in the same box with no layout shift.
 */
export function TourCardSkeleton({ className }: { className?: string }) {
    return <Bar className={cn('aspect-[3/4.1] w-full', className)} />;
}
