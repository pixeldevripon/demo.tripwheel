'use client';

import type { ReactNode } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import {
  BOOKING_DISPLAY_STATUS,
  REFUND_STATUS,
} from '@/components/common/status-maps';
import { formatDate } from '@/lib/utils';
import { bookingMoney, paymentModelLabel, refundDue } from '@/lib/bookings/format';
import type { BookingListItem } from '@/types/booking';

const entityLink =
  'hover:underline underline-offset-4 decoration-muted-foreground/50';

const money = bookingMoney;

interface MakeColumnsOptions {
  /** Adds Requested / Free window / Refund due columns (DASH3 queue). */
  cancellationView?: boolean;
  /** Trailing cell renderer (row-actions dropdown). */
  actions?: (booking: BookingListItem) => ReactNode;
  /** When set, the reference cell becomes a button that opens the details sheet. */
  onOpenDetails?: (booking: BookingListItem) => void;
}

export function makeBookingColumns({
  cancellationView = false,
  actions,
  onOpenDetails,
}: MakeColumnsOptions = {}): ColumnDef<BookingListItem>[] {
  const cols: ColumnDef<BookingListItem>[] = [
    {
      accessorKey: 'displayRef',
      header: 'Booking',
      cell: ({ row }) => {
        const b = row.original;
        const inner = (
          <>
            <span
              className={`font-mono text-sm font-medium block ${
                onOpenDetails ? entityLink : ''
              }`}
            >
              {b.displayRef}
            </span>
            <span className="text-xs text-muted-foreground">
              booked {formatDate(b.createdAt)}
            </span>
          </>
        );
        return onOpenDetails ? (
          <button
            type="button"
            onClick={(e) => {
              // The whole row opens the sheet too - don't fire it twice.
              e.stopPropagation();
              onOpenDetails(b);
            }}
            className="min-w-0 cursor-pointer border-none bg-transparent p-0 text-left"
          >
            {inner}
          </button>
        ) : (
          <div className="min-w-0">{inner}</div>
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
              onClick={(e) => e.stopPropagation()}
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
        // Opens the Customers list pre-filtered to this guest (there is no
        // per-customer page; ?q= drives its URL-synced search).
        return (
          <Link
            href={`/customers?q=${encodeURIComponent(b.contactEmail ?? b.contactFullName ?? '')}`}
            onClick={(e) => e.stopPropagation()}
            className="block min-w-0"
          >
            <span className={`text-sm truncate max-w-40 block ${entityLink}`}>
              {b.contactFullName ?? '-'}
            </span>
            <span className="text-xs text-muted-foreground truncate max-w-40 block">
              {b.contactEmail ?? ''}
            </span>
          </Link>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const meta = BOOKING_DISPLAY_STATUS[row.original.displayStatus];
        return (
          <StatusBadge variant={meta.variant} hint={meta.hint}>
            {meta.label}
          </StatusBadge>
        );
      },
      enableSorting: true,
    },
  ];

  // The queue is a decision list: Payment (total/model) and the free-window
  // verdict are context, not the decision - both live in the details sheet a
  // row click opens. The main bookings list keeps Payment.
  if (!cancellationView) {
    cols.push({
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
    });
  }

  if (cancellationView) {
    cols.push(
      {
        id: 'refund',
        header: 'Refund',
        cell: ({ row }) => {
          const b = row.original;
          const due = refundDue(b);
          // The refund STATUS is the ledger truth (has the money actually moved),
          // never assumed from the cancel verdict. A cancelled booking can sit
          // "Refund pending" with the charge still held (Stripe off / no charge).
          // One badge, amount folded into the label: "Refunded (€560)".
          if (b.refundStatus && b.refundStatus !== 'NONE') {
            const meta = REFUND_STATUS[b.refundStatus];
            return (
              <StatusBadge variant={meta.variant} hint={meta.hint}>
                {meta.label}
                {due ? ` (${due})` : ''}
              </StatusBadge>
            );
          }
          // No ledger movement yet, but an in-window request owes this much.
          if (due) {
            return <StatusBadge variant="neutral">Due ({due})</StatusBadge>;
          }
          return <span className="text-xs text-muted-foreground">-</span>;
        },
        enableSorting: false,
      },
    );
  }

  cols.push({
    id: 'actions',
    header: '',
    cell: ({ row }) =>
      actions ? (
        // Rows open the detail sheet; keep menu clicks out of that.
        <div onClick={(e) => e.stopPropagation()}>{actions(row.original)}</div>
      ) : null,
    enableSorting: false,
    enableHiding: false,
    size: 48,
  });

  return cols;
}
