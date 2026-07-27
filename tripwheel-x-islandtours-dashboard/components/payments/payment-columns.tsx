'use client';

import { type ColumnDef } from '@tanstack/react-table';
import Link from 'next/link';
import { StatusBadge } from '@/components/common/status-badge';
import { PAYMENT_STATUS } from '@/components/common/status-maps';
import { formatDate } from '@/lib/utils';
import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type { PaymentKind, PaymentListItem } from '@/types/booking';
import { PaymentRowActions } from './payment-row-actions';

export const kindLabel: Record<PaymentKind, string> = {
  DEPOSIT: 'Deposit',
  BALANCE: 'Balance',
  FULL: 'Full',
  REFUND: 'Refund',
};

export function money(amount: string, rawCurrency: string): string {
  const currency: Currency = isCurrency(rawCurrency) ? rawCurrency : 'EUR';
  return formatPriceFrom(amount, currency, 'en');
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
        return (
          <div className="min-w-0">
            <span className="text-sm font-medium tabular-nums block">
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
