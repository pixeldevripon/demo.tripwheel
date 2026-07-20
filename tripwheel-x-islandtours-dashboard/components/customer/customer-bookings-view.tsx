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
import { bookingMoney } from '@/lib/bookings/format';
import { formatDate } from '@/lib/utils';
import type { BookingListItem } from '@/types/booking';
import { CustomerBookingDetails } from './customer-booking-details';

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
            accessorKey: 'status',
            header: 'Status',
            cell: ({ row }) => {
                const meta = BOOKING_STATUS[row.original.status];
                return (
                    <StatusBadge variant={meta.variant}>
                        {meta.label}
                    </StatusBadge>
                );
            },
        },
        {
            accessorKey: 'paymentStatus',
            header: 'Payment',
            cell: ({ row }) => {
                const meta = BOOKING_PAYMENT_STATE[row.original.paymentStatus];
                return (
                    <StatusBadge variant={meta.variant}>
                        {meta.label}
                    </StatusBadge>
                );
            },
        },
        {
            accessorKey: 'totalRetail',
            header: 'Total',
            cell: ({ row }) => (
                <span className='text-sm font-medium'>
                    {bookingMoney(
                        row.original.totalRetail,
                        row.original.currency,
                    )}
                </span>
            ),
        },
    ];

    return (
        <div className='space-y-4'>
            {/* Stat row - live ledger numbers, never aggregate snapshots */}
            <div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
                <StatCard
                    label='Trips booked'
                    value={summary ? String(summary.bookingsCount) : '–'}
                />
                <StatCard
                    label='Upcoming'
                    value={summary ? String(summary.upcomingCount) : '–'}
                />
                <StatCard
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

function StatCard({ label, value }: { label: string; value: string }) {
    return (
        <div className='rounded-lg border border-border bg-card p-4'>
            <p className='m-0 text-xs text-muted-foreground'>{label}</p>
            <p className='m-0 mt-1 text-xl font-semibold text-foreground'>
                {value}
            </p>
        </div>
    );
}
