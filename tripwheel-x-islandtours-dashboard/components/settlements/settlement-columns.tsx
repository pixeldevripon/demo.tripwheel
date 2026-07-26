'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { StatusBadge } from '@/components/common/status-badge';
import { SETTLEMENT_STATUS } from '@/components/common/status-maps';
import { formatDate } from '@/lib/utils';
import { formatPriceFrom } from '@/lib/currency/current';
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type { SettlementListItem } from '@/types/booking';
import { SettlementRowActions } from './settlement-row-actions';

function money(amount: string, rawCurrency: string): string {
    const currency: Currency = isCurrency(rawCurrency) ? rawCurrency : 'EUR';
    return formatPriceFrom(amount, currency, 'en');
}

/**
 * Payout-ledger columns, self-describing for BOTH sides (founder 2026-07-26:
 * "no ambiguity, no guessing"). Every row is a paid_in_full booking:
 * Island Tours collected the total, keeps its commission, and owes the
 * operator the rest. The status cell always says what happens next in plain
 * words; the admin additionally gets the manual "Mark as paid" action.
 */
export function makeSettlementColumns(
    isAdmin: boolean,
): ColumnDef<SettlementListItem>[] {
    const columns: ColumnDef<SettlementListItem>[] = [
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
    ];

    if (isAdmin) {
        columns.push({
            id: 'operator',
            header: 'Operator',
            cell: ({ row }) => (
                <span className='text-sm truncate max-w-40 block'>
                    {row.original.operatorName ?? row.original.operatorId}
                </span>
            ),
            enableSorting: false,
        });
    }

    columns.push(
        {
            id: 'collected',
            header: 'Booking total',
            cell: ({ row }) => {
                const s = row.original;
                return (
                    <div className='min-w-0'>
                        <span className='text-sm tabular-nums block'>
                            {money(s.amountCollected, s.currency)}
                        </span>
                        <span className='text-xs text-muted-foreground tabular-nums'>
                            Island Tours keeps{' '}
                            {money(s.commissionOwed, s.currency)}
                        </span>
                    </div>
                );
            },
            enableSorting: false,
        },
        {
            id: 'payout',
            header: isAdmin ? 'Payout to operator' : 'Your payout',
            cell: ({ row }) => {
                const s = row.original;
                const reversed = s.status === 'REVERSED';
                // A reversed row's net was zeroed; show the would-have-been
                // payout struck through so the history stays readable.
                const wouldHaveBeen = (
                    Number(s.amountCollected) - Number(s.commissionOwed)
                ).toFixed(2);
                return (
                    <div className='min-w-0'>
                        <span
                            className={`text-sm font-medium tabular-nums block ${
                                reversed
                                    ? 'text-muted-foreground line-through'
                                    : ''
                            }`}
                        >
                            {money(
                                reversed ? wouldHaveBeen : s.netPosition,
                                s.currency,
                            )}
                        </span>
                        {reversed && (
                            <span className='text-xs text-muted-foreground'>
                                cancelled - nothing owed
                            </span>
                        )}
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
                // One plain-words line about what happens NEXT - nobody should
                // have to decode a badge.
                const next = s.payoutHeld
                    ? 'On hold - cancellation requested'
                    : s.status === 'PAID_OUT' && s.settledAt
                      ? `Paid ${formatDate(s.settledAt)}`
                      : s.status === 'RECORDED' && s.payoutEligible
                        ? isAdmin
                            ? 'Ready to pay'
                            : 'Awaiting transfer from Island Tours'
                        : s.status === 'RECORDED' && s.payoutReleaseAt
                          ? `Clears for payout ${formatDate(s.payoutReleaseAt)}`
                          : null;
                return (
                    <div className='flex flex-col items-start gap-1'>
                        <StatusBadge
                            variant={SETTLEMENT_STATUS[s.status].variant}
                            hint={SETTLEMENT_STATUS[s.status].hint}
                        >
                            {SETTLEMENT_STATUS[s.status].label}
                        </StatusBadge>
                        {next && (
                            <span
                                className={`text-xs ${
                                    s.payoutHeld
                                        ? 'text-warning-fg'
                                        : s.payoutEligible &&
                                            s.status === 'RECORDED'
                                          ? 'text-success-fg'
                                          : 'text-muted-foreground'
                                }`}
                            >
                                {next}
                            </span>
                        )}
                    </div>
                );
            },
            enableSorting: true,
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
    );

    if (isAdmin) {
        columns.push({
            id: 'actions',
            header: '',
            cell: ({ row }) => <SettlementRowActions row={row.original} />,
            enableSorting: false,
            enableHiding: false,
        });
    }

    return columns;
}
