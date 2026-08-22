import type { ReactNode } from 'react';

/** Appears above the table while rows are selected (05 §7). */
export function DataTableBulkBar({
    count,
    children,
}: {
    count: number;
    children: ReactNode;
}) {
    return (
        <div className='flex items-center gap-3 rounded-md border border-line bg-surface-inset px-4 py-2'>
            <span className='text-xs font-medium tabular-nums'>
                {count} selected
            </span>
            <div className='ml-auto flex items-center gap-2'>{children}</div>
        </div>
    );
}
