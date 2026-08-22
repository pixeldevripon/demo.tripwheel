'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/common/status-badge';
import { CUSTOMER_TIER, customerTier } from '@/components/common/status-maps';
import type { CustomerListItem } from '@/types/customer';
import { CustomerRowActions } from './customer-row-actions';

/** `Anna Meijer` -> `AM`; falls back to the email so a nameless row still reads. */
function initials(name: string | null, email: string): string {
  const source = (name ?? email.split('@')[0]).trim();
  const parts = source.split(/[\s._-]+/).filter(Boolean);
  return (
    (parts[0]?.[0] ?? '?') + (parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '')
  ).toUpperCase();
}

/** Lifetime spend is EUR-normalized on the server, so the symbol is fixed. */
const eur = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

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
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex min-w-0 items-center gap-3">
            <Avatar className="size-8 shrink-0">
              <AvatarFallback className="text-2xs font-medium">
                {initials(c.name, c.email)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="truncate font-medium">{c.name ?? '—'}</div>
              <div className="truncate text-xs text-muted-foreground">
                {c.email}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'bookingsCount',
      header: 'Bookings',
      cell: ({ row }) => {
        const tier = CUSTOMER_TIER[customerTier(row.original.bookingsCount)];
        return (
          <div className="flex items-center gap-2">
            <span className="tabular-nums font-medium">
              {row.original.bookingsCount}
            </span>
            <StatusBadge variant={tier.variant} hint={tier.hint}>
              {tier.label}
            </StatusBadge>
          </div>
        );
      },
    },
    {
      accessorKey: 'totalSpendEur',
      header: 'Lifetime spend',
      cell: ({ row }) => {
        // Returned as a decimal STRING to survive the wire without float drift;
        // parsed only for display, never for arithmetic.
        const n = Number(row.original.totalSpendEur);
        return (
          <span className="tabular-nums font-medium">
            {Number.isFinite(n) ? eur.format(n) : '—'}
          </span>
        );
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        // Rows open the detail sheet; keep action clicks out of that (the
        // "Ask for review" button and menu trigger already stopPropagation).
        <div onClick={(e) => e.stopPropagation()}>
          <CustomerRowActions customer={row.original} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ];

  if (opts.showOperator) {
    cols.splice(2, 0, {
      accessorKey: 'operatorName',
      header: 'Operator',
      cell: ({ row }) => (
        <span className="truncate text-sm text-muted-foreground">
          {row.original.operatorName ?? '—'}
        </span>
      ),
    });
  }

  return cols;
}
