'use client';

import { type ColumnDef } from '@tanstack/react-table';
import { CreditCardIcon } from '@hugeicons/core-free-icons';
import { DataTable } from '@/components/data-table/data-table';
import { useTableState } from '@/components/data-table/use-table-state';
import { StatusBadge } from '@/components/common/status-badge';
import { PAYMENT_STATUS } from '@/components/common/status-maps';
import { usePayments } from '@/hooks/payments/use-payments';
import { useCustomerBookingSummary } from '@/hooks/bookings/use-bookings';
import { bookingMoney } from '@/lib/bookings/format';
import { formatDate } from '@/lib/utils';
import type { PaymentKind, PaymentListItem } from '@/types/booking';
import { CustomerStatCard } from './customer-stat-card';

const KIND_LABEL: Record<PaymentKind, string> = {
    DEPOSIT: 'Deposit',
    BALANCE: 'Balance',
    FULL: 'Full payment',
    REFUND: 'Refund',
};

/**
 * The customer's payments/transactions view: every platform charge and refund
 * on their OWN bookings (the shared GET /payments - the backend scopes USER
 * callers to booking.userId). Customer-framed columns; no operator context
 * (commission, guest identity) and no filters.
 */
export function CustomerPaymentsView() {
    const { page, limit, setPage, setLimit } = useTableState();
    const { data, isLoading } = usePayments({ page, limit });
    const { data: summary } = useCustomerBookingSummary();

    const columns: ColumnDef<PaymentListItem>[] = [
        {
            accessorKey: 'createdAt',
            header: 'Payment',
            cell: ({ row }) => (
                <div className='min-w-0'>
                    <span className='block text-sm font-medium'>
                        {KIND_LABEL[row.original.kind]}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                        {formatDate(row.original.createdAt)}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'bookingDisplayRef',
            header: 'Booking',
            cell: ({ row }) => (
                <div className='min-w-0'>
                    <span className='block font-mono text-sm'>
                        {row.original.bookingDisplayRef}
                    </span>
                    <span className='block truncate text-xs text-muted-foreground'>
                        {row.original.tourName}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'bookingLocalDate',
            header: 'Travel date',
            cell: ({ row }) => (
                <span className='text-sm'>
                    {formatDate(row.original.bookingLocalDate)}
                </span>
            ),
        },
        {
            accessorKey: 'methodType',
            header: 'Method',
            cell: ({ row }) => (
                <div className='min-w-0'>
                    <span className='block text-sm capitalize'>
                        {row.original.methodType ?? '–'}
                    </span>
                    <span className='block text-xs capitalize text-muted-foreground'>
                        {row.original.provider.toLowerCase()}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'amount',
            header: 'Amount',
            cell: ({ row }) => (
                <span
                    className={`text-sm font-medium ${
                        row.original.kind === 'REFUND'
                            ? 'text-success-fg'
                            : ''
                    }`}>
                    {row.original.kind === 'REFUND' ? '-' : ''}
                    {bookingMoney(row.original.amount, row.original.currency)}
                </span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const meta = PAYMENT_STATUS[row.original.status];
                return (
                    <StatusBadge variant={meta.variant}>
                        {meta.label}
                    </StatusBadge>
                );
            },
        },
    ];

    return (
        <div className='space-y-4'>
            {/* Both figures come from real endpoints - the transaction count
                from the paginated total, net spend from /bookings/me/summary.
                Never sum the current page: that would silently mean "this page
                only" while reading as a lifetime total. */}
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                <CustomerStatCard
                    label='Transactions'
                    value={data ? String(data.total) : '–'}
                    hint='Charges and refunds on your bookings'
                />
                <CustomerStatCard
                    label='Net paid'
                    value={
                        summary
                            ? summary.totalSpend.length
                                ? summary.totalSpend
                                      .map(s =>
                                          bookingMoney(s.amount, s.currency),
                                      )
                                      .join(' + ')
                                : bookingMoney('0', 'EUR')
                            : '–'
                    }
                    hint='Successful payments minus refunds'
                />
            </div>

            <DataTable
                columns={columns}
                data={data?.data ?? []}
                isLoading={isLoading}
                pagination={{
                    total: data?.total ?? 0,
                    page,
                    limit,
                    onPageChange: setPage,
                    onLimitChange: setLimit,
                }}
                empty={{
                    icon: CreditCardIcon,
                    title: 'No payments yet.',
                    description:
                        'Charges and refunds on your bookings appear here.',
                }}
                getRowId={row => row.id}
            />
        </div>
    );
}
