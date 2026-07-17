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
import { PlusIcon, TagIcon, ChevronLeftIcon, ChevronRightIcon, ChevronsLeftIcon, ChevronsRightIcon, Settings2Icon } from 'lucide-react';
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
import { categoryColumns } from './category-columns';
import { useUpdateCategory, useDeleteCategory } from '@/hooks/categories/use-categories';
import { useRole } from '@/contexts/role-context';
import type { CategoryLocalized } from '@/types/category';

interface CategoriesTableProps {
  data: CategoryLocalized[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export function CategoriesTable({
  data,
  total,
  page,
  limit,
  isLoading,
  onPageChange,
  onLimitChange,
  onFilterChange,
}: CategoriesTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');

  const { mutate: updateCategory } = useUpdateCategory();
  const { mutate: deleteCategory } = useDeleteCategory();
  const { can } = useRole();

  const table = useReactTable({
    data,
    columns: categoryColumns,
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
      updateCategory(
        { id, payload: { isActive: true } },
        {
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to activate.'),
        }
      )
    );
    toast.success(`${ids.length} category(s) activated.`);
    setRowSelection({});
  }

  function handleBulkDeactivate() {
    const ids = selectedRows.map((r) => r.original.id);
    ids.forEach((id) =>
      updateCategory(
        { id, payload: { isActive: false } },
        {
          onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to deactivate.'),
        }
      )
    );
    toast.success(`${ids.length} category(s) deactivated.`);
    setRowSelection({});
  }

  function handleBulkDelete() {
    const rows = selectedRows.filter((r) => !r.original.isSeeded);
    if (rows.length === 0) {
      toast.error('No deletable categories selected. Seeded categories are protected.');
      return;
    }
    rows.forEach((r) =>
      deleteCategory(r.original.id, {
        onError: (err) => toast.error(err instanceof Error ? err.message : 'Failed to delete.'),
      })
    );
    toast.success(`${rows.length} category(s) deleted.`);
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
            placeholder="Search categories..."
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
          {can('CREATE_CATEGORY') && (
            <Button asChild size="sm">
              <Link href="/categories/new">
                <PlusIcon />
                Add Category
              </Link>
            </Button>
          )}
        </div>
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-none bg-muted px-4 py-2 text-sm">
          <span className="font-medium text-xs">
            {selectedCount} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={handleBulkActivate}>
              Activate
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkDeactivate}>
              Deactivate
            </Button>
            {can('DELETE_CATEGORY') && (
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
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
                    className="text-xs font-semibold"
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
                <TableCell colSpan={categoryColumns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TagIcon className="size-8 opacity-40" />
                    <p className="text-sm">No categories found.</p>
                    <p className="text-xs">Add your first category to get started.</p>
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
            Page {page} of {totalPages || 1}
          </span>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(1)} disabled={page <= 1}>
            <ChevronsLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            <ChevronLeftIcon />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
            <ChevronRightIcon />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => onPageChange(totalPages)} disabled={page >= totalPages}>
            <ChevronsRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
