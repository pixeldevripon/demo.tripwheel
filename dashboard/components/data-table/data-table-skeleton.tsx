import { Skeleton } from '@/components/ui/skeleton';

/**
 * Mirrors the real table's dimensions (03 §5.6: skeletons must match the
 * layout they replace - three tables used to render NO loading state at all).
 * Header row + `rows` body rows at the real h-12 row height.
 */
export function DataTableSkeleton({
    columns,
    rows = 8,
}: {
    columns: number;
    rows?: number;
}) {
    return (
        <div className='overflow-hidden rounded-lg border border-line bg-surface-raised'>
            <div className='flex h-12 items-center gap-4 border-b border-line px-3'>
                {Array.from({ length: columns }).map((_, i) => (
                    <Skeleton key={i} className='h-3 flex-1' />
                ))}
            </div>
            {Array.from({ length: rows }).map((_, r) => (
                <div
                    key={r}
                    className='flex h-12 items-center gap-4 border-b border-line-subtle px-3 last:border-0'>
                    {Array.from({ length: columns }).map((_, c) => (
                        <Skeleton key={c} className='h-4 flex-1' />
                    ))}
                </div>
            ))}
        </div>
    );
}
