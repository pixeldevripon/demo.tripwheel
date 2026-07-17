'use client';

import { useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronsLeftIcon,
  ChevronsRightIcon,
  SearchIcon,
  Settings2Icon,
  TicketIcon,
} from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { DatePickerField } from '@/components/date-picker-field';
import { useRole } from '@/contexts/role-context';
import type { BookingListItem } from '@/types/booking';
import { makeBookingColumns } from './booking-columns';
import { BookingRowActions } from './booking-row-actions';

interface BookingsTableProps {
  data: BookingListItem[];
  total: number;
  page: number;
  limit: number;
  isLoading: boolean;
  searchValue: string;
  /** DASH3 queue mode: request/window/refund columns, no status filter. */
  cancellationView?: boolean;
  onSearchChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onFilterChange: (key: string, value: string | undefined) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

const STATUS_OPTIONS = [
  'ON_HOLD',
  'PENDING',
  'CONFIRMED',
  'REDEEMED',
  'EXPIRED',
  'CANCELLED',
  'REJECTED',
] as const;

const MODEL_OPTIONS = [
  ['OPERATOR_LINK', 'Operator link'],
  ['ON_ARRIVAL', 'On arrival'],
  ['PAID_IN_FULL', 'Paid in full'],
  ['OPERATOR_FULL', 'Operator full'],
] as const;

export function BookingsTable({
  data,
  total,
  page,
  limit,
  isLoading,
  searchValue,
  cancellationView = false,
  onSearchChange,
  onPageChange,
  onLimitChange,
  onFilterChange,
}: BookingsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [modelFilter, setModelFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { role } = useRole();

  const columns = makeBookingColumns({
    cancellationView,
    // Commission is the platform's cut (rule #22 snapshot) - admin eyes only.
    showCommission: role === 'ADMIN',
    actions: (booking) => <BookingRowActions booking={booking} />,
  });

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / limit),
  });

  const totalPages = Math.ceil(total / limit);

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value);
    onFilterChange('status', value === 'all' ? undefined : value);
  }

  function handleModelFilterChange(value: string) {
    setModelFilter(value);
    onFilterChange('paymentModel', value === 'all' ? undefined : value);
  }

  function handleFromChange(value: string) {
    setFromDate(value);
    onFilterChange('from', value || undefined);
  }

  function handleToChange(value: string) {
    setToDate(value);
    onFilterChange('to', value || undefined);
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
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-36">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search ref, guest, email or tour..."
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
          />
        </div>

        {!cancellationView && (
          <Select value={statusFilter} onValueChange={handleStatusFilterChange}>
            <SelectTrigger className="w-32 shrink-0">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {STATUS_OPTIONS.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0) + s.slice(1).toLowerCase().replace('_', ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select value={modelFilter} onValueChange={handleModelFilterChange}>
          <SelectTrigger className="w-44 shrink-0">
            <SelectValue placeholder="Payment model" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Models</SelectItem>
            {MODEL_OPTIONS.map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Travel-date range (matches the backend `from`/`to` on localDate). */}
        <div className="flex items-center gap-1 shrink-0">
          <div className="w-36">
            <DatePickerField
              value={fromDate}
              onChange={handleFromChange}
              placeholder="From date"
              clearable
            />
          </div>
          <span className="text-xs text-muted-foreground">to</span>
          <div className="w-36">
            <DatePickerField
              value={toDate}
              onChange={handleToChange}
              placeholder="To date"
              clearable
            />
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto max-[400px]:w-full max-[400px]:ml-0 max-[400px]:justify-end">
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
        </div>
      </div>

      <div className="rounded-none ring-1 ring-foreground/5 overflow-hidden">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{
                      width:
                        header.getSize() !== 150 ? header.getSize() : undefined,
                    }}
                    className="text-xs font-semibold uppercase tracking-wider"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
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
                <TableCell colSpan={columns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <TicketIcon className="size-8 opacity-40" />
                    <p className="text-sm">
                      {cancellationView
                        ? 'No cancellation requests.'
                        : 'No bookings found.'}
                    </p>
                    <p className="text-xs">
                      {cancellationView
                        ? 'Traveller cancellation requests land here (master 6.4).'
                        : 'No bookings match the current filters.'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
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
          <Select
            value={String(limit)}
            onValueChange={(val) => onLimitChange(Number(val))}
          >
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
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(1)}
            disabled={page <= 1}
          >
            <ChevronsLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            <ChevronLeftIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            <ChevronRightIcon />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
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
