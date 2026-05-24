'use client';

import { useState } from 'react';
import Link from 'next/link';
import { PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TripsTable } from './trips-table';
import { useMyTrips } from '@/hooks/trips/use-trips';
import { useRole } from '@/contexts/role-context';
import type { TripStatus } from '@/types/trip';

export function TripsListView() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<Record<string, string | undefined>>({});
  const { can } = useRole();

  const { data, isLoading } = useMyTrips({
    page,
    limit,
    ...(filters.status ? { status: filters.status as TripStatus } : {}),
  });

  function handleFilterChange(key: string, value: string | undefined) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit);
    setPage(1);
  }

  return (
    <div className="space-y-4">
      {can('CREATE_TRIP') && (
        <div className="flex justify-end">
          <Button asChild size="sm">
            <Link href="/dashboard/trips/new">
              <PlusIcon />
              New Trip
            </Link>
          </Button>
        </div>
      )}
      <TripsTable
        data={data?.data ?? []}
        total={data?.total ?? 0}
        page={page}
        limit={limit}
        isLoading={isLoading}
        onPageChange={setPage}
        onLimitChange={handleLimitChange}
        onFilterChange={handleFilterChange}
      />
    </div>
  );
}
