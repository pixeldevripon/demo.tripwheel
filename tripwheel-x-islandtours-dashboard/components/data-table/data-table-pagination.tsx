'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowLeftDoubleIcon, ArrowRight01Icon, ArrowRightDoubleIcon } from '@hugeicons/core-free-icons';

import type { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';

interface ServerPagination {
    total: number;
    page: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}

interface DataTablePaginationProps<TData> {
    table: Table<TData>;
    /** Present = server-driven; absent = TanStack client paging. */
    pagination?: ServerPagination;
    isLoading?: boolean;
}

export function DataTablePagination<TData>({
    table,
    pagination,
    isLoading = false,
}: DataTablePaginationProps<TData>) {
    const server = pagination != null;

    const page = server
        ? pagination.page
        : table.getState().pagination.pageIndex + 1;
    const totalPages = server
        ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
        : Math.max(1, table.getPageCount());

    const goTo = (next: number) => {
        if (server) pagination.onPageChange(next);
        else table.setPageIndex(next - 1);
    };

    return (
        // Page size is fixed at 20 (use-table-state / DataTable defaults);
        // the rows-per-page selector was removed on purpose, so the pager
        // sits alone on the right.
        <div className='flex items-center justify-end px-1'>
            <div className='flex items-center gap-1'>
                <span className='mr-2 text-xs tabular-nums text-muted-foreground'>
                    Page {page} of {totalPages}
                </span>
                <Button
                    variant='outline'
                    size='icon-sm'
                    aria-label='First page'
                    onClick={() => goTo(1)}
                    disabled={isLoading || page <= 1}>
                    <HugeiconsIcon icon={ArrowLeftDoubleIcon} />
                </Button>
                <Button
                    variant='outline'
                    size='icon-sm'
                    aria-label='Previous page'
                    onClick={() => goTo(page - 1)}
                    disabled={isLoading || page <= 1}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} />
                </Button>
                <Button
                    variant='outline'
                    size='icon-sm'
                    aria-label='Next page'
                    onClick={() => goTo(page + 1)}
                    disabled={isLoading || page >= totalPages}>
                    <HugeiconsIcon icon={ArrowRight01Icon} />
                </Button>
                <Button
                    variant='outline'
                    size='icon-sm'
                    aria-label='Last page'
                    onClick={() => goTo(totalPages)}
                    disabled={isLoading || page >= totalPages}>
                    <HugeiconsIcon icon={ArrowRightDoubleIcon} />
                </Button>
            </div>
        </div>
    );
}
