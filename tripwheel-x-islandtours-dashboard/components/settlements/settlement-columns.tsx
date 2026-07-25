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
                const reversed = s.status === 'REVERSED';
                // + = IT owes the operator (a payout); - = operator owes IT.
                const tone =
                    reversed || net === 0
                        ? 'text-muted-foreground'
                        : net > 0
                          ? 'text-success-fg'
                          : 'text-danger-fg';
                return (
                    <div className='min-w-0'>
                        <span className={`text-sm font-medium tabular-nums block ${tone}`}>
                            {money(s.netPosition, s.currency)}
                        </span>
                        <span className='text-xs text-muted-foreground'>
                            {reversed
                                ? 'reversed (cancelled)'
                                : net > 0
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
                    <div className='flex flex-col items-start gap-1'>
                        <StatusBadge
                            variant={SETTLEMENT_STATUS[s.status].variant}
                            hint={SETTLEMENT_STATUS[s.status].hint}>
                            {SETTLEMENT_STATUS[s.status].label}
                        </StatusBadge>
                        {s.payoutHeld ? (
                            <span className='text-xs text-warning-fg'>
                                On hold - cancellation requested
                            </span>
                        ) : s.payoutEligible ? (
                            <span className='text-xs text-success-fg'>
                                Ready to pay out
                            </span>
                        ) : null}
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
                const reversed = s.status === 'REVERSED';
                // WHEN + HOW. Payout release date only for operator payouts; else the
                // method label alone says how it settles (self-settling / invoice).
                // A reversed row never pays out - the obligation was voided.
                const when = reversed
                    ? 'Cancelled - no payout'
                    : s.status === 'PAID_OUT' && s.settledAt
                      ? `Paid ${formatDate(s.settledAt)}`
                      : s.payoutHeld
                        ? 'Held - cancellation requested'
                        : s.payoutReleaseAt
                          ? `Releases ${formatDate(s.payoutReleaseAt)}`
                          : null;
                return (
                    <div className='min-w-0'>
                        <span className='text-sm block'>
                            {reversed ? '-' : SETTLEMENT_METHOD_LABEL[s.method]}
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
