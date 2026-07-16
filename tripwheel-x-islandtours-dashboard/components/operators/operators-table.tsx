'use client';

import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table';
import {
  PlusIcon,
  SearchIcon,
  StoreIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Skeleton } from '@/components/ui/skeleton';
import { buildOperatorColumns } from './operator-columns';
import { useUpdateOperator } from '@/hooks/operators/use-operators';
import { useRole } from '@/contexts/role-context';
import type { OperatorListItem } from '@/types/operator';

interface OperatorsTableProps {
  data: OperatorListItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onStatusFilterChange: (value: string) => void;
  statusFilter: string;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

export function OperatorsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  search,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onStatusFilterChange,
  statusFilter,
}: OperatorsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const { mutateAsync: updateOperatorAsync } = useUpdateOperator();
  const { can } = useRole();

  const columns = useMemo(() => buildOperatorColumns(), []);

  const table = useReactTable({
    data,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / limit),
  });

  const totalPages = Math.ceil(total / limit) || 1;
  const selectedRows = table.getSelectedRowModel().rows;
  const selectedCount = selectedRows.length;

  async function bulkSetActive(isActive: boolean) {
    const ids = selectedRows.map((r) => r.original.id);
    const results = await Promise.allSettled(
      ids.map((id) => updateOperatorAsync({ id, payload: { isActive } }))
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(`${ok} operator(s) ${isActive ? 'activated' : 'deactivated'}.`);
    if (failed) toast.error(`${failed} update(s) failed.`);
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
          <div className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search operators..."
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={onStatusFilterChange}>
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
        {can('MANAGE_OPERATORS') && (
          <Button asChild size="sm">
            <Link href="/tour-operators/new">
              <PlusIcon />
              Add Tour Operator
            </Link>
          </Button>
        )}
      </div>

      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-none bg-muted px-4 py-2 text-sm">
          <span className="font-medium text-xs uppercase tracking-wider">
            {selectedCount} selected
          </span>
          {can('MANAGE_OPERATORS') && (
            <div className="flex items-center gap-2 ml-auto">
              <Button size="xs" variant="outline" onClick={() => bulkSetActive(true)}>
                Activate
              </Button>
              <Button size="xs" variant="outline" onClick={() => bulkSetActive(false)}>
                Deactivate
              </Button>
            </div>
          )}
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
                    <StoreIcon className="size-8 opacity-40" />
                    <p className="text-sm">No tour operators found.</p>
                    <p className="text-xs">Add your first operator to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
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
