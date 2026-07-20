'use client';

import { useState } from 'react';
import { type ColumnDef } from '@tanstack/react-table';
import { Ticket01Icon } from '@hugeicons/core-free-icons';
import { DataTable } from '@/components/data-table/data-table';
import { useTableState } from '@/components/data-table/use-table-state';
import { StatusBadge } from '@/components/common/status-badge';
import {
    BOOKING_PAYMENT_STATE,
    BOOKING_STATUS,
} from '@/components/common/status-maps';
import {
    useBookings,
    useCustomerBookingSummary,
} from '@/hooks/bookings/use-bookings';
import { bookingMoney, freeCancellationNote } from '@/lib/bookings/format';
import { formatDate } from '@/lib/utils';
import type { BookingListItem } from '@/types/booking';
import { CustomerBookingDetails } from './customer-booking-details';
import { CustomerStatCard } from './customer-stat-card';

/**
 * The customer's "My Bookings" view: a stat row (trips / upcoming / total
 * spent, from GET /bookings/me/summary) over a compact table of their OWN
 * bookings (the shared GET /bookings - the backend scopes USER callers to
 * booking.userId). Deliberately customer-framed: no operator columns
 * (commission, guest contact), no filters - most customers have a handful of
 * rows. Row click opens the details sheet with the cancellation-request flow.
 */
export function CustomerBookingsView() {
    const { page, limit, setPage, setLimit } = useTableState();
    const { data, isLoading } = useBookings({ page, limit });
    const { data: summary } = useCustomerBookingSummary();
    const [selected, setSelected] = useState<BookingListItem | null>(null);

    const columns: ColumnDef<BookingListItem>[] = [
        {
            accessorKey: 'displayRef',
            header: 'Booking',
            cell: ({ row }) => (
                <div className='min-w-0'>
                    <span className='block font-mono text-sm font-medium'>
                        {row.original.displayRef}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                        booked {formatDate(row.original.createdAt)}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'tourName',
            header: 'Tour',
            cell: ({ row }) => (
                <div className='min-w-0'>
                    <span className='block truncate text-sm font-medium'>
                        {row.original.tourName}
                    </span>
                    <span className='text-xs text-muted-foreground'>
                        {formatDate(row.original.localDate)}
                        {row.original.startTime
                            ? ` · ${row.original.startTime}`
                            : ''}
                    </span>
                </div>
            ),
        },
        {
            accessorKey: 'partySize',
            header: 'Travelers',
            cell: ({ row }) => (
                <span className='text-sm'>{row.original.partySize}</span>
            ),
        },
        {
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const b = row.original;
                const meta = BOOKING_STATUS[b.status];
                const freeUntil = freeCancellationNote(b);
                return (
                    <div className='min-w-0 space-y-1'>
                        <StatusBadge variant={meta.variant}>
                            {meta.label}
                        </StatusBadge>
                        {freeUntil ? (
                            <span className='block text-xs text-muted-foreground'>
                                {freeUntil}
                            </span>
                        ) : null}
                    </div>
                );
            },
        },
        {
            accessorKey: 'paymentStatus',
            header: 'Payment',
            cell: ({ row }) => {
                const b = row.original;
                const meta = BOOKING_PAYMENT_STATE[b.paymentStatus];
                return (
                    <div className='min-w-0 space-y-1'>
                        <StatusBadge variant={meta.variant}>
                            {meta.label}
                        </StatusBadge>
                        <span className='block text-xs text-muted-foreground'>
                            {bookingMoney(b.paidAmount, b.currency)} paid
                        </span>
                    </div>
                );
            },
        },
        {
            accessorKey: 'totalRetail',
            header: 'Total',
            cell: ({ row }) => {
                const b = row.original;
                const balance = Number(b.balanceAmount);
                return (
                    <div className='min-w-0'>
                        <span className='block text-sm font-medium'>
                            {bookingMoney(b.totalRetail, b.currency)}
                        </span>
                        {balance > 0 ? (
                            <span className='block text-xs text-muted-foreground'>
                                {bookingMoney(b.balanceAmount, b.currency)} due
                                to operator
                            </span>
                        ) : null}
                    </div>
                );
            },
        },
    ];

    return (
        <div className='space-y-4'>
            {/* Stat row - live ledger numbers, never aggregate snapshots */}
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                <CustomerStatCard
                    label='Trips booked'
                    value={summary ? String(summary.bookingsCount) : '–'}
                    hint='Confirmed and completed'
                />
                <CustomerStatCard
                    label='Upcoming'
                    value={summary ? String(summary.upcomingCount) : '–'}
                    hint='Still to travel'
                />
                <CustomerStatCard
                    label='Total spent'
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
                    hint='Paid to Island Tours, net of refunds'
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
                    icon: Ticket01Icon,
                    title: 'No bookings yet.',
                    description:
                        'Your bookings appear here the moment they are confirmed.',
                }}
                onRowClick={setSelected}
                getRowId={row => row.id}
            />

            <CustomerBookingDetails
                booking={selected}
                onOpenChange={open => {
                    if (!open) setSelected(null);
                }}
            />
        </div>
    );
}
