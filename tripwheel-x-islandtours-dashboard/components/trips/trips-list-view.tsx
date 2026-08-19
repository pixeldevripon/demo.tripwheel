'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { useMyTrips, useAdminTrips } from '@/hooks/trips/use-trips';
import type { TripApprovalStatus, TripStatus } from '@/types/trip';
import { useRole } from '@/contexts/role-context';
import { isPlatformWideRole } from '@/lib/rbac-utils';
import { TripsTable } from './trips-table';

export function TripsListView() {
    const { role, can } = useRole();
    // "Whose catalogue is this", not "is this an ADMIN". Platform staff and
    // editors read the whole catalogue too, and testing for ADMIN alone sent
    // them down the operator branch, where the backend has no operator to
    // resolve - an empty Tours screen (test report 2026-08-01 §Admin.4). This
    // drives PRESENTATION: the Operator column and the platform-wide copy.
    const isPlatformView = isPlatformWideRole(role);
    // ...and this drives WHICH ROUTE answers, because the two questions have
    // different answers. `/tours/admin/all` is gated on MANAGE_TRIPS, which an
    // Operations Manager does not hold; `/tours/my-tours` is gated on
    // VIEW_TRIPS and now scopes itself platform-wide for a platform role. So a
    // read-only platform seat takes the second route and still sees everything
    // it is entitled to, instead of collecting a 403 from the first.
    const useAdminRoute = can('MANAGE_TRIPS');

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
        setFilters,
    } = useTableState();

    const operatorQueryParams = {
        page,
        limit,
        ...(filters.status ? { status: filters.status as TripStatus } : {}),
        // A separate backend filter, not a fifth status. The toolbar presents
        // both in one "Status" dropdown because that is how an operator thinks
        // about it, so exactly one of the two is ever set (reported 2026-08-02
        // §03 - a resubmitted paused tour was unfindable).
        ...(filters.approvalStatus
            ? { approvalStatus: filters.approvalStatus as TripApprovalStatus }
            : {}),
        ...(filters.destinationId
            ? { destinationId: filters.destinationId }
            : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };

    const adminQueryParams = {
        ...operatorQueryParams,
        ...(filters.operatorId ? { operatorId: filters.operatorId } : {}),
    };

    const operatorQuery = useMyTrips(operatorQueryParams, !useAdminRoute);
    const adminQuery = useAdminTrips(adminQueryParams, useAdminRoute);

    const { data, isLoading } = useAdminRoute ? adminQuery : operatorQuery;

    return (
        <div className='space-y-4'>
            <TripsTable
                data={data?.data ?? []}
                total={data?.total ?? 0}
                page={page}
                limit={limit}
                isLoading={isLoading}
                searchValue={search}
                isAdminView={isPlatformView}
                filters={filters}
                onSearchChange={setSearch}
                onPageChange={setPage}
                onLimitChange={setLimit}
                onFilterChange={setFilter}
                onFiltersChange={setFilters}
            />
        </div>
    );
}
