'use client';

import { useMyTrips, useAdminTrips } from '@/hooks/trips/use-trips';
import { isMockTripId } from '@/lib/mock/trip-fixtures';
import type { TripStatus } from '@/types/trip';
import { useEffect, useState } from 'react';
import { InfoIcon } from 'lucide-react';
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
        const timer = setTimeout(() => setDebouncedSearch(search), 350);
        return () => clearTimeout(timer);
    }, [search]);

    const operatorQueryParams = {
        page,
        limit,
        ...(filters.status ? { status: filters.status as TripStatus } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };

    const adminQueryParams = {
        page,
        limit,
        ...(filters.status ? { status: filters.status as TripStatus } : {}),
        ...(filters.operatorId ? { operatorId: filters.operatorId } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };

    const operatorQuery = useMyTrips(operatorQueryParams, !isAdmin);
    const adminQuery = useAdminTrips(adminQueryParams, isAdmin);

    const { data, isLoading } = isAdmin ? adminQuery : operatorQuery;

    const showingSampleData = (data?.data?.length ?? 0) > 0 && isMockTripId(data?.data?.[0]?.id);

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
            {showingSampleData && (
                <div className='flex items-start gap-2 border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'>
                    <InfoIcon className='size-4 mt-0.5 shrink-0' />
                    <div>
                        <p className='font-semibold'>Showing sample data</p>
                        <p className='text-amber-700'>
                            No tours were returned by the API, so 10 fully populated sample tours are shown as a
                            fallback. Open any row to explore every tab with example data. These are read-only
                            previews - edits will not be saved.
                        </p>
                    </div>
                </div>
            )}
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
