'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type RowSelectionState,
} from '@tanstack/react-table';
import { PlusIcon, MapPinIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, Settings2Icon } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TableSearchInput } from '@/components/table-search-input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { destinationColumns } from './destination-columns';
import { useUpdateDestination, useDeleteDestination } from '@/hooks/destinations/use-destinations';
import { useRole } from '@/contexts/role-context';
import type { DestinationLocalized } from '@/types/destination';

interface DestinationsTableProps {
  data: DestinationLocalized[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export function DestinationsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  onPageChange,
  onLimitChange,
  onFilterChange,
}: DestinationsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const { mutate: updateDestination } = useUpdateDestination();
  const { mutate: deleteDestination } = useDeleteDestination();
  const { can } = useRole();

  const table = useReactTable({
    data,
    columns: destinationColumns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / limit),
  });

  const totalPages = Math.ceil(total / limit);
  const selectedRows = table.getFilteredSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value);
    if (value === 'all') {
      onFilterChange('isActive', undefined);
    } else {
      onFilterChange('isActive', value === 'active' ? 'true' : 'false');
    }
  }

  function handleBulkActivate() {
    const ids = selectedRows.map((r) => r.original.id);
    ids.forEach((id) =>
      updateDestination(
        { id, payload: { isActive: true } },
        {
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to activate.'),
        }
      )
    );
    toast.success(`${ids.length} destination(s) activated.`);
    setRowSelection({});
  }

  function handleBulkDeactivate() {
    const ids = selectedRows.map((r) => r.original.id);
    ids.forEach((id) =>
      updateDestination(
        { id, payload: { isActive: false } },
        {
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to deactivate.'),
        }
      )
    );
    toast.success(`${ids.length} destination(s) deactivated.`);
    setRowSelection({});
  }

  function handleBulkDelete() {
    const rows = selectedRows.filter((r) => !r.original.isSeeded);
    if (rows.length === 0) {
      toast.error('No deletable destinations selected. Seeded destinations are protected.');
      return;
    }
    rows.forEach((r) =>
      deleteDestination(r.original.id, {
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete.'),
      })
    );
    toast.success(`${rows.length} destination(s) deleted.`);
    setRowSelection({});
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-none" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 flex-1">
          <TableSearchInput
            value={globalFilter}
            onValueChange={setGlobalFilter}
            placeholder="Search destinations..."
            className="max-w-sm"
          />
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Settings2Icon />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              {table
                .getAllColumns()
                .filter((col) => col.getCanHide())
                .map((col) => (
                  <DropdownMenuCheckboxItem
                    key={col.id}
                    className="capitalize"
                    checked={col.getIsVisible()}
                    onCheckedChange={(value) => col.toggleVisibility(!!value)}
                  >
                    {col.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {can('CREATE_DESTINATION') && (
            <Button asChild size="sm">
              <Link href="/destinations/new">
                <PlusIcon />
                Add Destination
              </Link>
            </Button>
          )}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-none bg-muted px-4 py-2 text-sm">
          <span className="font-medium text-xs uppercase tracking-wider">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="xs" variant="outline" onClick={handleBulkActivate}>
              Activate
            </Button>
            <Button size="xs" variant="outline" onClick={handleBulkDeactivate}>
              Deactivate
            </Button>
            {can('DELETE_DESTINATION') && (
              <Button size="xs" variant="destructive" onClick={handleBulkDelete}>
                Delete
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="rounded-none ring-1 ring-foreground/5 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.getSize() !== 150 ? header.getSize() : undefined }}
                    className="text-xs font-semibold uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={destinationColumns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <MapPinIcon className="size-8 opacity-40" />
                    <p className="text-sm">No destinations found.</p>
                    <p className="text-xs">Add your first destination to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Rows per page</span>
          <Select value={String(limit)} onValueChange={(val) => onLimitChange(Number(val))}>
            <SelectTrigger className="w-20 h-8">
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
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground mr-2">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={() => onPageChange(totalPages)}
            disabled={page >= totalPages}
          >
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
