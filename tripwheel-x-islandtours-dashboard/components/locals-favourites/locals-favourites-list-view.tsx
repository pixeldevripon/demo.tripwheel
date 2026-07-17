'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import type { TripStatus } from '@/types/trip';
import { LocalsFavouritesTable } from './locals-favourites-table';

/**
 * Owns list state (URL-synced pagination + filters + debounced search) and
 * feeds the table. Mirrors trips-list-view; admin-only surface (page is gated
 * by MANAGE_EDITORIAL), so it always uses the admin tour list.
 */
export function LocalsFavouritesListView() {
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

  const { data, isLoading } = useAdminTrips({
    page,
    limit,
    ...(filters.status ? { status: filters.status as TripStatus } : {}),
    ...(filters.destinationId ? { destinationId: filters.destinationId } : {}),
    ...(filters.operatorId ? { operatorId: filters.operatorId } : {}),
    ...(filters.isLocalsFavourite
      ? { isLocalsFavourite: filters.isLocalsFavourite === 'true' }
      : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  });

  return (
    <LocalsFavouritesTable
      data={data?.data ?? []}
      total={data?.total ?? 0}
      page={page}
      limit={limit}
      isLoading={isLoading}
      filters={filters}
      searchValue={search}
      onSearchChange={setSearch}
      onPageChange={setPage}
      onLimitChange={setLimit}
      onFilterChange={setFilter}
    />
  );
}
