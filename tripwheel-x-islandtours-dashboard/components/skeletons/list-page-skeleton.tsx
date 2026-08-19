import { DataTableSkeleton } from '@/components/data-table/data-table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Route-level placeholder for the table pages (Bookings, Payments,
 * Cancellation Requests), rendered by each route's `loading.tsx`.
 *
 * Mirrors the real page anatomy - title block, toolbar (search + filter
 * controls + view options), the table itself, then the pagination row - so the
 * layout does not jump when the page commits. `title` and `description` are
 * the REAL strings rather than grey bars: they are static text the server
 * already knows, so showing them immediately makes the navigation read as
 * finished while only the rows are still arriving.
 */
export function ListPageSkeleton({
    title,
    description,
    columns,
    filters = 2,
    rows = 8,
}: {
    title: string;
    description: string;
    /** Column count of the table being replaced, so widths line up. */
    columns: number;
    /** Filter controls in the toolbar, beside the search field. */
    filters?: number;
    rows?: number;
}) {
    return (
        <div>
            <div className='mb-6 flex flex-wrap items-center justify-between gap-4'>
                <div>
                    <h1 className='text-2xl font-medium'>{title}</h1>
                    <p className='text-sm text-muted-foreground mt-1'>
                        {description}
                    </p>
                </div>
            </div>

            <div className='space-y-4'>
                {/* Toolbar: search grows, filters and view options are fixed. */}
                <div className='flex flex-wrap items-center gap-2'>
                    <Skeleton className='h-9 w-full max-w-64' />
                    {Array.from({ length: filters }).map((_, i) => (
                        <Skeleton key={i} className='h-9 w-36' />
                    ))}
                    <Skeleton className='h-9 w-24 ml-auto' />
                </div>

                <DataTableSkeleton columns={columns} rows={rows} />

                {/* Pagination: row count on the left, page controls on the right. */}
                <div className='flex items-center justify-between'>
                    <Skeleton className='h-4 w-40' />
                    <div className='flex items-center gap-2'>
                        <Skeleton className='h-8 w-8' />
                        <Skeleton className='h-8 w-8' />
                        <Skeleton className='h-8 w-8' />
                    </div>
                </div>
            </div>
        </div>
    );
}

