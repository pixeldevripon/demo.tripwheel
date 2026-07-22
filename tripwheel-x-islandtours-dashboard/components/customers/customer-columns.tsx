'use client';

import type { ColumnDef } from '@tanstack/react-table';
import { HugeiconsIcon } from '@hugeicons/react';
import { StarIcon } from '@hugeicons/core-free-icons';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/common/status-badge';
import {
  CUSTOMER_REVIEW_STATE,
  CUSTOMER_TIER,
  customerTier,
} from '@/components/common/status-maps';
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

/**
 * "3 days ago" under the date.
 *
 * A date alone makes the reader do the arithmetic to answer the only question
 * they have here: is this person recent, or long gone?
 */
function relativeDays(iso: string | null): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return null;
  const days = Math.round((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 31) return `${days} days ago`;
  const months = Math.round(days / 30);
  if (months < 24) return `${months} mo ago`;
  return `${Math.round(days / 365)} yr ago`;
}

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
            <StatusBadge variant={tier.variant}>{tier.label}</StatusBadge>
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
      accessorKey: 'reviewsLeft',
      header: 'Reviews',
      cell: ({ row }) => {
        const c = row.original;
        const state =
          c.awaitingReview > 0
            ? CUSTOMER_REVIEW_STATE.awaiting
            : c.reviewsLeft > 0
              ? CUSTOMER_REVIEW_STATE.all_reviewed
              : CUSTOMER_REVIEW_STATE.none;
        return (
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 tabular-nums font-medium">
              <HugeiconsIcon
                icon={StarIcon}
                className="size-3.5 text-muted-foreground"
              />
              {c.reviewsLeft}
            </span>
            <StatusBadge variant={state.variant}>
              {/* The count belongs IN the badge when there is one: "Awaiting"
                  alone leaves the reader hunting for how many. */}
              {c.awaitingReview > 0
                ? `${c.awaitingReview} awaiting`
                : state.label}
            </StatusBadge>
          </div>
        );
      },
    },
    {
      accessorKey: 'lastBookingAt',
      header: 'Last booking',
      cell: ({ row }) => {
        const ago = relativeDays(row.original.lastBookingAt);
        return (
          <div className="min-w-0 whitespace-nowrap">
            <div className="text-sm">{shortDate(row.original.lastBookingAt)}</div>
            {ago ? (
              <div className="text-xs text-muted-foreground">{ago}</div>
            ) : null}
          </div>
        );
      },
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
        <span className="truncate text-sm text-muted-foreground">
          {row.original.operatorName ?? '—'}
        </span>
      ),
    });
  }

  return cols;
}
