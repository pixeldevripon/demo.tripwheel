'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { useBookings } from '@/hooks/bookings/use-bookings';
import type {
    BookingPaymentModel,
    BookingStatus,
    BookingsQueryParams,
} from '@/types/booking';
import { BookingsTable } from './bookings-table';

/**
 * Owns the server-driven list state (page/limit/filters/debounced search) for
 * both the Bookings page and the Cancellation Requests queue (DASH3 passes
 * `cancellationRequested` so only requested bookings come back, oldest first).
 */
export function BookingsListView({
    cancellationView = false,
}: {
    cancellationView?: boolean;
}) {
    const {
        page,
        limit,
        search,
        debouncedSearch,
        filters,
        setPage,
        setLimit,
        setSearch,
        setFilter,
    } = useTableState();

    // Queue mode is a WORK LIST, so it defaults to what is still outstanding:
    // a request is pending exactly while it has a stamp and the booking is
    // still CONFIRMED; processing it flips the booking to CANCELLED. Without
    // this the queue only ever grew, and because it sorts oldest-first the
    // already-handled rows sat on top of the ones needing attention.
    // Implemented as a filter default rather than a hard exclusion so the
    // processed history stays one dropdown away.
    //
    // Caveat on Processed: the backend queue filter is just
    // `utcCancellationRequestedAt != null`, and cancel() stamps that field on
    // EVERY cancellation (defaulting to now when there was no prior request).
    // So Processed reads as "cancellation history" and includes admin-initiated
    // cancellations nobody ever requested. Pending is exact; only Processed is
    // loose. Fixing it means not stamping absent a real request, which would
    // change the refund-instant semantics - deliberately left alone.
    const queueFilter = cancellationView ? (filters.queue ?? 'pending') : null;
    const queueStatus =
        queueFilter === 'pending'
            ? 'CONFIRMED'
            : queueFilter === 'processed'
              ? 'CANCELLED'
              : undefined;

    const params: BookingsQueryParams = {
        page,
        limit,
        ...(cancellationView ? { cancellationRequested: true } : {}),
        ...(queueStatus ? { status: queueStatus as BookingStatus } : {}),
        ...(!cancellationView && filters.status
            ? { status: filters.status as BookingStatus }
            : {}),
        ...(filters.paymentModel
            ? { paymentModel: filters.paymentModel as BookingPaymentModel }
            : {}),
        // Deep links carry it (tour calendar's "report it on the booking"
        // filters to that tour + travel day); the URL is the filter UI here.
        ...(filters.tourId ? { tourId: filters.tourId } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };

    const { data, isLoading } = useBookings(params);




    return (
        <div className='space-y-4'>
            <BookingsTable
                data={data?.data ?? []}
                total={data?.total ?? 0}
                page={page}
                limit={limit}
                isLoading={isLoading}
                filters={filters}
                searchValue={search}
                cancellationView={cancellationView}
                onSearchChange={setSearch}
                onPageChange={setPage}
                onLimitChange={setLimit}
                onFilterChange={setFilter}
            />
        </div>
    );
}
