'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { StatusBadge } from '@/components/common/status-badge';
import {
  PAYMENT_STATUS,
  SETTLEMENT_METHOD_LABEL,
  SETTLEMENT_STATUS,
} from '@/components/common/status-maps';
import { formatDate } from '@/lib/utils';
import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type { PaymentKind, PaymentListItem } from '@/types/booking';

const kindLabel: Record<PaymentKind, string> = {
  DEPOSIT: 'Deposit',
  BALANCE: 'Balance',
  FULL: 'Full',
  REFUND: 'Refund',
};

function money(amount: string, rawCurrency: string): string {
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
            <span className="text-xs text-muted-foreground truncate max-w-40 block">
              {p.contactFullName ?? ''}
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
      id: 'settlement',
      header: 'Settlement',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="min-w-0">
            {p.settlementStatus ? (
              <StatusBadge
                variant={SETTLEMENT_STATUS[p.settlementStatus].variant}
                hint={SETTLEMENT_STATUS[p.settlementStatus].hint}
              >
                {SETTLEMENT_STATUS[p.settlementStatus].label}
              </StatusBadge>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            )}
            <span className="text-xs text-muted-foreground block mt-0.5">
              {SETTLEMENT_METHOD_LABEL[p.settlementMethod]}
            </span>
          </div>
        );
      },
      enableSorting: false,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }) => (
        <span className="text-muted-foreground text-xs">
          {formatDate(row.original.createdAt, 'long')}
        </span>
      ),
      enableSorting: true,
    },
  ];
}
