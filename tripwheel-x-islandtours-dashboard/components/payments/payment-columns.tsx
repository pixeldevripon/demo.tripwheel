'use client';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import { PAYMENT_STATUS } from '@/components/common/status-maps';
import { formatDate } from '@/lib/utils';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type { PaymentKind, PaymentListItem } from '@/types/booking';
import { PaymentRowActions } from './payment-row-actions';

export const kindLabel: Record<PaymentKind, string> = {
  DEPOSIT: 'Deposit',
  BALANCE: 'Balance',
  FULL: 'Full payment',
  REFUND: 'Refund',
};

/**
 * Ledger money: unlike the listing "From" prices (formatPriceFrom, which keeps
 * whole amounts bare), admin money columns always carry cents so $36.00 and
 * $89.25 read as the same kind of number.
 */
export function money(amount: string, rawCurrency: string): string {
  const currency: Currency = isCurrency(rawCurrency) ? rawCurrency : 'EUR';
  const n = Number(amount);
  return new Intl.NumberFormat('en', {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);
}

export function makePaymentColumns(): ColumnDef<PaymentListItem>[] {
  return [
    {
      accessorKey: 'bookingDisplayRef',
      header: 'Booking',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-0">
            <span className="font-mono text-sm font-medium block">
              {p.bookingDisplayRef}
            </span>
            {p.contactFullName && (
              // Customers list pre-filtered to this guest (name is all the
              // payment row carries; there is no per-customer page).
              <Link
                href={`/customers?q=${encodeURIComponent(p.contactFullName)}`}
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-muted-foreground truncate max-w-40 block hover:underline underline-offset-4"
              >
                {p.contactFullName}
              </Link>
            )}
          </div>
        );
      },
      enableSorting: true,
    },
    {
      id: 'tour',
      header: 'Tour / Travel date',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-0">
            <span className="text-sm truncate max-w-48 block">{p.tourName}</span>
            <span className="text-xs text-muted-foreground">
              {formatDate(p.bookingLocalDate)}
            </span>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: ({ row }) => {
        const p = row.original;
        // Refunds are money OUT: signed and tinted so they can never be
        // mistaken for the charge they reverse one row away.
        const isRefund = p.kind === 'REFUND';
        return (
          <div className="min-w-0">
            <span
              className={`text-sm font-medium tabular-nums block ${
                isRefund ? 'text-danger-fg' : ''
              }`}
            >
              {isRefund ? '-' : ''}
              {money(p.amount, p.currency)}
            </span>
            <span className="text-xs text-muted-foreground">
              {kindLabel[p.kind]}
            </span>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      // The date the MONEY moved - and the one the date filter above actually
      // matches on (payment.createdAt). Test report 2026-08-01 read the filter
      // as broken because the only date on the row was the TRAVEL date: a
      // deposit taken on 30 Jul for a tour on 29 Aug looks out of range when
      // "29 Aug" is all you can see. Reconciliation needs the date it filters
      // by to be visible next to the amount it is reconciling.
      id: 'paidOn',
      header: 'Paid on',
      cell: ({ row }) => (
        <span className="text-sm whitespace-nowrap">
          {formatDate(row.original.createdAt)}
        </span>
      ),
      enableSorting: false,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          variant={PAYMENT_STATUS[row.original.status].variant}
          hint={PAYMENT_STATUS[row.original.status].hint}
        >
          {PAYMENT_STATUS[row.original.status].label}
        </StatusBadge>
      ),
      enableSorting: true,
    },
    {
      id: 'method',
      header: 'Provider / Method',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-0">
            <span className="text-sm capitalize block">
              {p.provider.toLowerCase()}
              {p.methodType ? ` · ${p.methodType}` : ''}
            </span>
            {p.intentId && (
              <span className="font-mono text-xs text-muted-foreground truncate max-w-44 block">
                {p.intentId}
              </span>
            )}
          </div>
        );
      },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        // Rows open the detail sheet; keep menu clicks out of that.
        <div onClick={(e) => e.stopPropagation()}>
          <PaymentRowActions payment={row.original} />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
  ];
}
