'use client';

import { useMyTrips, useAdminTrips } from '@/hooks/trips/use-trips';
import type { TripStatus } from '@/types/trip';
import { useEffect, useState } from 'react';
import { useRole } from '@/contexts/role-context';
import { TripsTable } from './trips-table';

export function TripsListView() {
    const { role } = useRole();
    const isAdmin = role === 'ADMIN';

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [filters, setFilters] = useState<Record<string, string | undefined>>({});
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

    const operatorQueryParams = {
        page,
        limit,
        ...(filters.status ? { status: filters.status as TripStatus } : {}),
        ...(filters.destinationId ? { destinationId: filters.destinationId } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };

    const adminQueryParams = {
        page,
        limit,
        ...(filters.status ? { status: filters.status as TripStatus } : {}),
        ...(filters.operatorId ? { operatorId: filters.operatorId } : {}),
        ...(filters.destinationId ? { destinationId: filters.destinationId } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };

    const operatorQuery = useMyTrips(operatorQueryParams, !isAdmin);
    const adminQuery = useAdminTrips(adminQueryParams, isAdmin);

    const { data, isLoading } = isAdmin ? adminQuery : operatorQuery;

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
            <TripsTable
                data={data?.data ?? []}
                total={data?.total ?? 0}
                page={page}
                limit={limit}
                isLoading={isLoading}
                searchValue={search}
                isAdminView={isAdmin}
                onSearchChange={handleSearchChange}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
                onFilterChange={handleFilterChange}
            />
        </div>
    );
}
