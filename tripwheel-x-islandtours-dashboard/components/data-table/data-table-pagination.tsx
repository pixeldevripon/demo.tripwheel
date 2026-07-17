'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft01Icon, ArrowLeftDoubleIcon, ArrowRight01Icon, ArrowRightDoubleIcon } from '@hugeicons/core-free-icons';

import type { Table } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

/** Declared ONCE, here (05 §7 validation criterion). */
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

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
    const limit = server
        ? pagination.limit
        : table.getState().pagination.pageSize;
    const totalPages = server
        ? Math.max(1, Math.ceil(pagination.total / pagination.limit))
        : Math.max(1, table.getPageCount());

    const goTo = (next: number) => {
        if (server) pagination.onPageChange(next);
        else table.setPageIndex(next - 1);
    };
    const setLimit = (next: number) => {
        if (server) pagination.onLimitChange(next);
        else table.setPageSize(next);
    };

    return (
        <div className='flex items-center justify-between px-1'>
            <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <span>Rows per page</span>
                <Select
                    value={String(limit)}
                    onValueChange={(v) => setLimit(Number(v))}>
                    <SelectTrigger
                        size='sm'
                        className='w-18'
                        aria-label='Rows per page'>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {PAGE_SIZE_OPTIONS.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                                {size}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
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
