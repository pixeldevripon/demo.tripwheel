'use client';

import * as React from 'react';
import {
    useReactTable,
    getCoreRowModel,
    getSortedRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    flexRender,
    type ColumnDef,
    type Row,
    type RowSelectionState,
    type SortingState,
    type Table as TanstackTable,
    type VisibilityState,
} from '@tanstack/react-table';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { DataTableBulkBar } from './data-table-bulk-bar';
import { DataTableEmpty, type DataTableEmptyProps } from './data-table-empty';
import { DataTablePagination } from './data-table-pagination';
import { contentSettle } from '@/lib/motion';
import { motion, useReducedMotion } from 'framer-motion';
import { DataTableSkeleton } from './data-table-skeleton';

/**
 * THE table (05 §7, G-3). Every list screen renders this - a module brings
 * its columns, its toolbar content, its empty state and (optionally) its bulk
 * actions, and nothing else. Do not hand-roll useReactTable + flexRender +
 * pagination in a module again; that is how the codebase grew eleven forks of
 * the same 300 lines.
 *
 * Pagination is SERVER-driven when `total`+`page`+`onPageChange` are given
 * (the normal case), and client-side otherwise - three list endpoints
 * (collections by destination, attributes, spotlight queue) return unpaged
 * arrays, and the backend contract is out of scope by hard constraint.
 */

interface ServerPagination {
    total: number;
    page: number;
    limit: number;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
}

export interface DataTableProps<TData> {
    columns: ColumnDef<TData, any>[];
    data: TData[];
    isLoading?: boolean;
    /** Server pagination; omit entirely for client-side paging. */
    pagination?: ServerPagination;
    empty: DataTableEmptyProps;
    /** Toolbar row above the table (search, filters, actions). */
    toolbar?: (table: TanstackTable<TData>) => React.ReactNode;
    /** Bulk actions; rendering is handled - return only the buttons. */
    bulkActions?: (
        rows: Row<TData>[],
        clearSelection: () => void,
    ) => React.ReactNode;
    getRowId?: (row: TData) => string;
    onRowClick?: (row: TData) => void;
    /** Rows rendered by the loading skeleton (match expected page size). */
    skeletonRows?: number;
}

export function DataTable<TData>({
    columns,
    data,
    isLoading = false,
    pagination,
    empty,
    toolbar,
    bulkActions,
    getRowId,
    onRowClick,
    skeletonRows = 8,
}: DataTableProps<TData>) {
    const reduceMotion = useReducedMotion();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnVisibility, setColumnVisibility] =
        React.useState<VisibilityState>({});
    const [rowSelection, setRowSelection] = React.useState<RowSelectionState>(
        {},
    );

    const server = pagination != null;

    const table = useReactTable({
        data,
        columns,
        state: { sorting, columnVisibility, rowSelection },
        onSortingChange: setSorting,
        onColumnVisibilityChange: setColumnVisibility,
        onRowSelectionChange: setRowSelection,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        ...(server
            ? {
                  manualPagination: true,
                  pageCount: Math.max(
                      1,
                      Math.ceil(pagination.total / pagination.limit),
                  ),
              }
            : {
                  getPaginationRowModel: getPaginationRowModel(),
                  initialState: { pagination: { pageSize: 20 } },
              }),
        ...(getRowId ? { getRowId } : {}),
    });

    const selectedRows = table.getFilteredSelectedRowModel().rows;
    const clearSelection = React.useCallback(
        () => setRowSelection({}),
        [setRowSelection],
    );

    return (
        <div className='space-y-4'>
            {toolbar && (
                <div className='flex flex-wrap items-center gap-2'>
                    {toolbar(table)}
                </div>
            )}

            {bulkActions && selectedRows.length > 0 && (
                <DataTableBulkBar count={selectedRows.length}>
                    {bulkActions(selectedRows, clearSelection)}
                </DataTableBulkBar>
            )}

            {isLoading ? (
                <DataTableSkeleton
                    columns={columns.length}
                    rows={skeletonRows}
                />
            ) : (
                /* Fades in rather than replacing the skeleton outright. This
                   swap fires on EVERY list page the moment its query resolves,
                   and as a bare ternary it was the most-seen hard cut in the
                   dashboard. Fade-only and short on purpose: `DataTableSkeleton`
                   already mirrors the real row height, so the rows land where
                   the placeholder sat and there is nothing to slide into place
                   - adding y travel here would read as a jump, not a settle.
                   `initial={false}` under reduced motion so it appears at once. */
                <motion.div
                    initial={reduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={contentSettle}
                    className='overflow-hidden rounded-lg border border-line bg-surface-raised'>
                    <Table>
                        <TableHeader>
                            {table.getHeaderGroups().map((headerGroup) => (
                                <TableRow key={headerGroup.id}>
                                    {headerGroup.headers.map((header) => (
                                        <TableHead
                                            key={header.id}
                                            style={{
                                                width:
                                                    header.getSize() !== 150
                                                        ? header.getSize()
                                                        : undefined,
                                            }}>
                                            {header.isPlaceholder
                                                ? null
                                                : flexRender(
                                                      header.column.columnDef
                                                          .header,
                                                      header.getContext(),
                                                  )}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            ))}
                        </TableHeader>
                        <TableBody>
                            {table.getRowModel().rows.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={columns.length}
                                        className='h-40 text-center'>
                                        <DataTableEmpty {...empty} />
                                    </TableCell>
                                </TableRow>
                            ) : (
                                table.getRowModel().rows.map((row) => (
                                    <TableRow
                                        key={row.id}
                                        data-state={
                                            row.getIsSelected()
                                                ? 'selected'
                                                : undefined
                                        }
                                        onClick={
                                            onRowClick
                                                ? () =>
                                                      onRowClick(row.original)
                                                : undefined
                                        }
                                        className={
                                            onRowClick
                                                ? 'cursor-pointer'
                                                : undefined
                                        }>
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </motion.div>
            )}

            <DataTablePagination
                table={table}
                pagination={pagination}
                isLoading={isLoading}
            />
        </div>
    );
}
