'use client';

import { useEffect, useState } from 'react';
import { useAdminTrips } from '@/hooks/trips/use-trips';
import type { TripStatus } from '@/types/trip';
import { LocalsFavouritesTable } from './locals-favourites-table';

/**
 * Owns list state (pagination + filters + debounced search) and feeds the table.
 * Mirrors trips-list-view; admin-only surface (page is gated by MANAGE_EDITORIAL),
 * so it always uses the admin tour list.
 */
export function LocalsFavouritesListView() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

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

  function handleFilterChange(key: string, value: string | undefined) {
    setFilters((prev) => ({ ...prev, [key]: value }));
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
    <LocalsFavouritesTable
      data={data?.data ?? []}
      total={data?.total ?? 0}
      page={page}
      limit={limit}
      isLoading={isLoading}
      searchValue={search}
      onSearchChange={handleSearchChange}
      onPageChange={setPage}
      onLimitChange={handleLimitChange}
      onFilterChange={handleFilterChange}
    />
  );
}
