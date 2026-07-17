'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { UserGroupIcon } from '@hugeicons/core-free-icons';

import type { ReactNode } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import { BOOKING_STATUS } from '@/components/common/status-maps';
import { formatDate } from '@/lib/utils';
import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type {
  BookingListItem,
  BookingPaymentModel,
} from '@/types/booking';

const entityLink =
  'hover:underline underline-offset-4 decoration-muted-foreground/50';

export const paymentModelLabel: Record<BookingPaymentModel, string> = {
  OPERATOR_LINK: 'Operator link',
  ON_ARRIVAL: 'On arrival',
  PAID_IN_FULL: 'Paid in full',
  OPERATOR_FULL: 'Operator full',
};

function money(amount: string | number, rawCurrency: string): string {
  const currency: Currency = isCurrency(rawCurrency) ? rawCurrency : 'EUR';
  return formatPriceFrom(amount, currency, 'en');
}

/**
 * The refund the traveller is entitled to when the cancellation request landed
 * inside the free window (C23, payment_model-aware): deposit models refund the
 * deposit, paid_in_full the whole payment, operator_full nothing (no platform
 * charge). Outside the window nothing is due from the platform.
 */
export function refundDue(b: BookingListItem): string | null {
  if (!b.requestedInFreeWindow) return null;
  if (b.paymentModel === 'OPERATOR_FULL') return null;
  const amount =
    b.paymentModel === 'PAID_IN_FULL' ? b.totalRetail : b.depositAmount;
  return Number(amount) > 0 ? money(amount, b.currency) : null;
}

interface MakeColumnsOptions {
  /** Adds Requested / Free window / Refund due columns (DASH3 queue). */
  cancellationView?: boolean;
  /** Show the commission columns (admin only - rule #22 snapshots). */
  showCommission?: boolean;
  /** Trailing cell renderer (row-actions dropdown). */
  actions?: (booking: BookingListItem) => ReactNode;
}

export function makeBookingColumns({
  cancellationView = false,
  showCommission = false,
  actions,
}: MakeColumnsOptions = {}): ColumnDef<BookingListItem>[] {
  const cols: ColumnDef<BookingListItem>[] = [
    {
      accessorKey: 'displayRef',
      header: 'Booking',
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="min-w-0">
            <span className="font-mono text-sm font-medium block">
              {b.displayRef}
            </span>
            <span className="text-xs text-muted-foreground">
              booked {formatDate(b.createdAt)}
            </span>
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: 'tour',
      header: 'Tour / Travel date',
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="min-w-0">
            <Link
              href={`/trips/${b.tourId}/edit`}
              className={`text-sm font-medium truncate max-w-48 block ${entityLink}`}
            >
              {b.tourName}
            </Link>
            <span className="text-xs text-muted-foreground">
              {formatDate(b.localDate)}
              {b.startTime ? ` · ${b.startTime}` : ''}
            </span>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: 'guest',
      header: 'Guest',
      cell: ({ row }) => {
        const b = row.original;
        if (!b.contactFullName && !b.contactEmail) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        return (
          <div className="min-w-0">
            <span className="text-sm truncate max-w-40 block">
              {b.contactFullName ?? '-'}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-40 block">
              {b.contactEmail ?? ''}
            </span>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: 'party',
      header: 'Party',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <HugeiconsIcon icon={UserGroupIcon} className="size-3.5 shrink-0" />
          <span className="tabular-nums">{row.original.partySize}</span>
        </div>
      ),
      enableSorting: false,
      size: 72,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const meta = BOOKING_STATUS[row.original.status];
        return <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>;
      },
      enableSorting: true,
    },
    {
      id: 'payment',
      header: 'Payment',
      cell: ({ row }) => {
        const b = row.original;
        return (
          <div className="min-w-0">
            <span className="text-sm font-medium tabular-nums block">
              {money(b.totalRetail, b.currency)}
            </span>
            <span className="text-xs text-muted-foreground">
              {paymentModelLabel[b.paymentModel]}
              {Number(b.depositAmount) > 0 &&
              Number(b.depositAmount) < Number(b.totalRetail)
                ? ` · deposit ${money(b.depositAmount, b.currency)}`
                : ''}
            </span>
          </div>
        );
      },
      enableSorting: false,
    },
  ];

  if (showCommission) {
    cols.push({
      id: 'commission',
      header: 'Commission',
      cell: ({ row }) => {
        const b = row.original;
        if (b.commissionAmount == null) {
          return <span className="text-xs text-muted-foreground">-</span>;
        }
        const pct =
          b.commissionRate != null
            ? `${(Number(b.commissionRate) * 100).toFixed(1)}%`
            : null;
        return (
          <div className="min-w-0">
            <span className="text-sm font-medium tabular-nums block">
              {money(b.commissionAmount, b.currency)}
            </span>
            {pct && <span className="text-xs text-muted-foreground">{pct}</span>}
          </div>
        );
      },
      enableSorting: false,
    });
  }

  if (cancellationView) {
    cols.push(
      {
        id: 'requested',
        header: 'Requested',
        cell: ({ row }) => {
          const at = row.original.utcCancellationRequestedAt;
          if (!at) return <span className="text-xs text-muted-foreground">-</span>;
          return (
            <span className="text-xs text-muted-foreground">
              {formatDate(at, 'long')}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        id: 'window',
        header: 'Free window',
        cell: ({ row }) => {
          const b = row.original;
          if (b.requestedInFreeWindow == null) {
            return <span className="text-xs text-muted-foreground">-</span>;
          }
          return (
            <div className="min-w-0">
              <StatusBadge
                variant={b.requestedInFreeWindow ? 'success' : 'neutral'}
              >
                {b.requestedInFreeWindow ? 'In window' : 'Outside window'}
              </StatusBadge>
              {b.freeCancelDeadline && (
                <span className="text-xs text-muted-foreground block mt-0.5">
                  until {formatDate(b.freeCancelDeadline, 'long')}
                </span>
              )}
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: 'refund',
        header: 'Refund due',
        cell: ({ row }) => {
          const due = refundDue(row.original);
          return due ? (
            <span className="text-sm font-medium tabular-nums text-success-fg">
              {due}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">-</span>
          );
        },
        enableSorting: false,
      },
    );
  }

  cols.push({
    id: 'actions',
    header: '',
    cell: ({ row }) => (actions ? actions(row.original) : null),
    enableSorting: false,
    enableHiding: false,
    size: 48,
  });

  return cols;
}
