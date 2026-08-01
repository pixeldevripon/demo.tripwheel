import { cn } from '@/lib/utils';
import { Bar } from './skeleton-bar';

/**
 * Loading skeleton for the collection grid card - design v2 .skl: ONE solid
 * shimmering paper block matching the card's footprint (image + title +
 * explore row), 12px radius.
 */
export function CollectionCardSkeleton({ className }: { className?: string }) {
    return <Bar className={cn('aspect-[3/3.4] w-full', className)} />;
}
