'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';
import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type { PaymentKind, PaymentListItem, PaymentStatus } from '@/types/booking';

const statusVariant: Record<
  PaymentStatus,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  REQUIRES_PAYMENT: 'secondary',
  PROCESSING: 'secondary',
  SUCCEEDED: 'default',
  FAILED: 'destructive',
  REFUNDED: 'outline',
  PARTIALLY_REFUNDED: 'outline',
  CANCELLED: 'destructive',
};

const statusLabel: Record<PaymentStatus, string> = {
  REQUIRES_PAYMENT: 'Requires payment',
  PROCESSING: 'Processing',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
  CANCELLED: 'Cancelled',
};

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
        <Badge variant={statusVariant[row.original.status]}>
          {statusLabel[row.original.status]}
        </Badge>
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
