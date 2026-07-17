'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { useMyTrips, useAdminTrips } from '@/hooks/trips/use-trips';
import type { TripStatus } from '@/types/trip';
import { useRole } from '@/contexts/role-context';
import { TripsTable } from './trips-table';

export function TripsListView() {
    const { role } = useRole();
    const isAdmin = role === 'ADMIN';

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

    const operatorQueryParams = {
        page,
        limit,
        ...(filters.status ? { status: filters.status as TripStatus } : {}),
        ...(filters.destinationId
            ? { destinationId: filters.destinationId }
            : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };

    const adminQueryParams = {
        ...operatorQueryParams,
        ...(filters.operatorId ? { operatorId: filters.operatorId } : {}),
    };

    const operatorQuery = useMyTrips(operatorQueryParams, !isAdmin);
    const adminQuery = useAdminTrips(adminQueryParams, isAdmin);

    const { data, isLoading } = isAdmin ? adminQuery : operatorQuery;

    return (
        <div className='space-y-4'>
            <TripsTable
                data={data?.data ?? []}
                total={data?.total ?? 0}
                page={page}
                limit={limit}
                isLoading={isLoading}
                searchValue={search}
                isAdminView={isAdmin}
                filters={filters}
                onSearchChange={setSearch}
                onPageChange={setPage}
                onLimitChange={setLimit}
                onFilterChange={setFilter}
            />
        </div>
    );
}
