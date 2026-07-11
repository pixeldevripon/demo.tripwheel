'use client';

import { useMemo, useState } from 'react';
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
import {
  PlusIcon,
  NavigationIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  Settings2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { TableSearchInput } from '@/components/dashboard/table-search-input';
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
import { buildHubColumns } from './hub-columns';
import { useUpdateHub, useDeleteHub } from '@/hooks/hubs/use-hubs';
import { useRole } from '@/contexts/role-context';
import type { HubLocalized } from '@/types/hub';
import type { DestinationLocalized } from '@/types/destination';

interface HubsTableProps {
  data: HubLocalized[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  destinations: DestinationLocalized[];
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export function HubsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  destinations,
  onPageChange,
  onLimitChange,
  onFilterChange,
}: HubsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [destinationFilter, setDestinationFilter] = useState<string>('all');

  const { mutate: updateHub } = useUpdateHub();
  const { mutate: deleteHub } = useDeleteHub();
  const { can } = useRole();

  const destinationsMap = useMemo(
    () => new Map(destinations.map((d) => [d.id, d.name])),
    [destinations]
  );

  const columns = useMemo(() => buildHubColumns({ destinationsMap }), [destinationsMap]);

  const table = useReactTable({
    data,
    columns,
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
    onFilterChange('isActive', value === 'all' ? undefined : value === 'active' ? 'true' : 'false');
  }

  function handleDestinationFilterChange(value: string) {
    setDestinationFilter(value);
    onFilterChange('destinationId', value === 'all' ? undefined : value);
  }

  function handleBulkActivate() {
    const ids = selectedRows.map((r) => r.original.id);
    ids.forEach((id) =>
      updateHub(
        { id, payload: { isActive: true } },
        { onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to activate.') }
      )
    );
    toast.success(`${ids.length} hub(s) activated.`);
    setRowSelection({});
  }

  function handleBulkDeactivate() {
    const ids = selectedRows.map((r) => r.original.id);
    ids.forEach((id) =>
      updateHub(
        { id, payload: { isActive: false } },
        { onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to deactivate.') }
      )
    );
    toast.success(`${ids.length} hub(s) deactivated.`);
    setRowSelection({});
  }

  function handleBulkDelete() {
    const rows = selectedRows.filter((r) => !r.original.isSeeded);
    if (rows.length === 0) {
      toast.error('No deletable hubs selected. Seeded hubs are protected.');
      return;
    }
    rows.forEach((r) =>
      deleteHub(r.original.id, {
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete.'),
      })
    );
    toast.success(`${rows.length} hub(s) deleted.`);
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
        <div className="flex items-center gap-2 flex-1 flex-wrap">
          <TableSearchInput
            value={globalFilter}
            onValueChange={setGlobalFilter}
            placeholder="Search hubs..."
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
          <Select value={destinationFilter} onValueChange={handleDestinationFilterChange}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Destination" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Destinations</SelectItem>
              {destinations.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
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
          {can('MANAGE_HUBS') && (
            <Button asChild size="sm">
              <Link href="/dashboard/hubs/new">
                <PlusIcon />
                Add Hub
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
            {can('MANAGE_HUBS') && (
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
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <NavigationIcon className="size-8 opacity-40" />
                    <p className="text-sm">No hubs found.</p>
                    <p className="text-xs">Add your first hub to get started.</p>
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
          <Button variant="outline" size="icon-xs" onClick={() => onPageChange(1)} disabled={page <= 1}>
            <ChevronsLeftIcon />
          </Button>
          <Button variant="outline" size="icon-xs" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon-xs" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" size="icon-xs" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
