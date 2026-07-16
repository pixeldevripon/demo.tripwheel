'use client';

import { useState } from 'react';
import { HubsTable } from './hubs-table';
import { useHubs } from '@/hooks/hubs/use-hubs';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';

export function HubsListView() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<Record<string, string | undefined>>({ isActive: 'true' });

  const { data, isLoading } = useHubs({
    page,
    limit,
    locale: 'en',
    ...(filters.isActive !== undefined ? { isActive: filters.isActive === 'true' } : {}),
    ...(filters.destinationId ? { destinationId: filters.destinationId } : {}),
  });

  const { data: destinations = [] } = useActiveDestinations('en');

  function handleFilterChange(key: string, value: string | undefined) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit);
    setPage(1);
  }

  return (
    <HubsTable
      data={data?.data ?? []}
      total={data?.total ?? 0}
      page={page}
      limit={limit}
      isLoading={isLoading}
      destinations={destinations}
      onPageChange={setPage}
      onLimitChange={handleLimitChange}
      onFilterChange={handleFilterChange}
    />
  );
}
