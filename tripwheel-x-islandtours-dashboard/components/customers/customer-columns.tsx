'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { CustomerListItem } from '@/types/customer';
import { CustomerRowActions } from './customer-row-actions';

/** `2026-07-18T…` -> `18 Jul 2026`. Dashes for an absent date, never "Invalid". */
function shortDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
}

export function customerColumns(opts: {
  /** Platform callers see whose customer a row is; an operator has only one. */
  showOperator: boolean;
}): ColumnDef<CustomerListItem, unknown>[] {
  const cols: ColumnDef<CustomerListItem, unknown>[] = [
    {
      id: 'select',
      header: ({ table }) => (
        <Checkbox
          checked={
            table.getIsAllPageRowsSelected() ||
            (table.getIsSomePageRowsSelected() && 'indeterminate')
          }
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(!!v)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: 'name',
      header: 'Customer',
      cell: ({ row }) => (
        <div className="min-w-0">
          <div className="truncate font-medium">
            {row.original.name ?? '—'}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {row.original.email}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'bookingsCount',
      header: 'Bookings',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.bookingsCount}</span>
      ),
    },
    {
      accessorKey: 'reviewsLeft',
      header: 'Reviews',
      cell: ({ row }) => (
        <span className="tabular-nums">{row.original.reviewsLeft}</span>
      ),
    },
    {
      accessorKey: 'awaitingReview',
      header: 'Awaiting review',
      cell: ({ row }) => {
        const n = row.original.awaitingReview;
        // The one number worth a badge: it is the reason to act on this row.
        return n > 0 ? (
          <Badge variant="secondary" className="tabular-nums">
            {n}
          </Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: 'lastBookingAt',
      header: 'Last booking',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-muted-foreground">
          {shortDate(row.original.lastBookingAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => <CustomerRowActions customer={row.original} />,
      enableSorting: false,
      enableHiding: false,
    },
  ];

  if (opts.showOperator) {
    cols.splice(2, 0, {
      accessorKey: 'operatorName',
      header: 'Operator',
      cell: ({ row }) => (
        <span className="truncate text-muted-foreground">
          {row.original.operatorName ?? '—'}
        </span>
      ),
    });
  }

  return cols;
}
