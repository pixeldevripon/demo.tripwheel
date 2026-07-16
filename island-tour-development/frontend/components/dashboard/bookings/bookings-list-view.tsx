'use client';

import { useEffect, useState } from 'react';
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
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [filters, setFilters] = useState<Record<string, string | undefined>>(
        {},
    );
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

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

    function handleFilterChange(key: string, value: string | undefined) {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    }

    function handleLimitChange(newLimit: number) {
        setLimit(newLimit);
        setPage(1);
    }

    function handleSearchChange(value: string) {
        setSearch(value);
        setPage(1);
    }

    return (
        <div className='space-y-4'>
            <BookingsTable
                data={data?.data ?? []}
                total={data?.total ?? 0}
                page={page}
                limit={limit}
                isLoading={isLoading}
                searchValue={search}
                cancellationView={cancellationView}
                onSearchChange={handleSearchChange}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
                onFilterChange={handleFilterChange}
            />
        </div>
    );
}
