'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { StatusBadge } from '@/components/common/status-badge';
import {
    SETTLEMENT_METHOD_LABEL,
    SETTLEMENT_STATUS,
} from '@/components/common/status-maps';
import { formatDate } from '@/lib/utils';
import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type { BookingPaymentModel, SettlementListItem } from '@/types/booking';

const modelLabel: Record<BookingPaymentModel, string> = {
    OPERATOR_LINK: 'Operator link',
    ON_ARRIVAL: 'On arrival',
    PAID_IN_FULL: 'Paid in full',
    OPERATOR_FULL: 'Operator full',
};

function money(amount: string, rawCurrency: string): string {
    const currency: Currency = isCurrency(rawCurrency) ? rawCurrency : 'EUR';
    return formatPriceFrom(amount, currency, 'en');
}

export function makeSettlementColumns(): ColumnDef<SettlementListItem>[] {
    return [
        {
            accessorKey: 'displayRef',
            header: 'Booking',
            cell: ({ row }) => {
                const s = row.original;
                return (
                    <div className='min-w-0'>
                        <span className='font-mono text-sm font-medium block'>
                            {s.displayRef}
                        </span>
                        <span className='text-xs text-muted-foreground truncate max-w-48 block'>
                            {s.tourName ?? ''}
                        </span>
                    </div>
                );
            },
            enableSorting: true,
        },
        {
            id: 'operator',
            header: 'Operator',
            cell: ({ row }) => (
                <span className='text-sm truncate max-w-40 block'>
                    {row.original.operatorName ?? row.original.operatorId}
                </span>
            ),
            enableSorting: false,
        },
        {
            id: 'model',
            header: 'Model',
            cell: ({ row }) => (
                <span className='text-sm'>
                    {modelLabel[row.original.paymentModel]}
                </span>
            ),
            enableSorting: false,
        },
        {
            id: 'collected',
            header: 'Collected / Commission',
            cell: ({ row }) => {
                const s = row.original;
                return (
                    <div className='min-w-0'>
                        <span className='text-sm tabular-nums block'>
                            {money(s.amountCollected, s.currency)}
                        </span>
                        <span className='text-xs text-muted-foreground tabular-nums'>
                            comm. {money(s.commissionOwed, s.currency)}
                        </span>
                    </div>
                );
            },
            enableSorting: false,
        },
        {
            id: 'net',
            header: 'Net position',
            cell: ({ row }) => {
                const s = row.original;
                const net = Number(s.netPosition);
                // + = IT owes the operator (a payout); - = operator owes IT.
                const tone =
                    net > 0
                        ? 'text-success-fg'
                        : net < 0
                          ? 'text-danger-fg'
                          : 'text-muted-foreground';
                return (
                    <div className='min-w-0'>
                        <span className={`text-sm font-medium tabular-nums block ${tone}`}>
                            {money(s.netPosition, s.currency)}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                            {net > 0
                                ? 'owed to operator'
                                : net < 0
                                  ? 'operator owes IT'
                                  : 'self-settling'}
                        </span>
                    </div>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const s = row.original;
                return (
                    <div className='flex flex-col gap-1'>
                        <StatusBadge
                            variant={SETTLEMENT_STATUS[s.status].variant}
                            hint={SETTLEMENT_STATUS[s.status].hint}>
                            {SETTLEMENT_STATUS[s.status].label}
                        </StatusBadge>
                        {s.payoutEligible && (
                            <span className='text-xs text-success-fg'>
                                Ready to pay out
                            </span>
                        )}
                    </div>
                );
            },
            enableSorting: true,
        },
        {
            id: 'settle',
            header: 'Settles',
            cell: ({ row }) => {
                const s = row.original;
                // WHEN + HOW. Payout release date only for operator payouts; else the
                // method label alone says how it settles (self-settling / invoice).
                const when =
                    s.status === 'PAID_OUT' && s.settledAt
                        ? `Paid ${formatDate(s.settledAt)}`
                        : s.payoutReleaseAt
                          ? `Releases ${formatDate(s.payoutReleaseAt)}`
                          : null;
                return (
                    <div className='min-w-0'>
                        <span className='text-sm block'>
                            {SETTLEMENT_METHOD_LABEL[s.method]}
                        </span>
                        {when && (
                            <span className='text-xs text-muted-foreground'>
                                {when}
                            </span>
                        )}
                    </div>
                );
            },
            enableSorting: false,
        },
        {
            accessorKey: 'createdAt',
            header: 'Recorded',
            cell: ({ row }) => (
                <span className='text-muted-foreground text-xs'>
                    {formatDate(row.original.createdAt, 'long')}
                </span>
            ),
            enableSorting: true,
        },
    ];
}
