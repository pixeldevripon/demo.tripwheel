'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import { LocalsFavouritesTable } from './locals-favourites-table';

/**
 * Owns list state (URL-synced pagination + filters + debounced search) and
 * feeds the table. Mirrors trips-list-view; admin-only surface (page is gated
 * by MANAGE_EDITORIAL), so it always uses the admin tour list.
 *
 * Pinned to LIVE tours: only they can appear on the public Locals' favourites
 * grid, so drafts/paused/archived tours are noise on this curation surface.
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
    status: 'LIVE',
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
