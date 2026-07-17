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

    const params: BookingsQueryParams = {
        page,
        limit,
        ...(cancellationView ? { cancellationRequested: true } : {}),
        ...(filters.status ? { status: filters.status as BookingStatus } : {}),
        ...(filters.paymentModel
            ? { paymentModel: filters.paymentModel as BookingPaymentModel }
            : {}),
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
