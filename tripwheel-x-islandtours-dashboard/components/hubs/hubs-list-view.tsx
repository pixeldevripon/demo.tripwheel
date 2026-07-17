'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { HubsTable } from './hubs-table';
import { useHubs } from '@/hooks/hubs/use-hubs';
import { useActiveDestinations } from '@/hooks/destinations/use-destinations';

export function HubsListView() {
    const { page, limit, filters, setPage, setLimit, setFilter } =
        useTableState();

    // isActive default is ACTIVE; 'all' in the URL means no filter.
    const isActiveParam =
        filters.isActive === 'all'
            ? {}
            : { isActive: (filters.isActive ?? 'true') === 'true' };

    const { data, isLoading } = useHubs({
        page,
        limit,
        locale: 'en',
        ...isActiveParam,
        ...(filters.destinationId ? { destinationId: filters.destinationId } : {}),
    });
    const { data: destinations = [] } = useActiveDestinations('en');

    return (
        <HubsTable
            data={data?.data ?? []}
            total={data?.total ?? 0}
            page={page}
            limit={limit}
            isLoading={isLoading}
            filters={filters}
            destinations={destinations}
            onPageChange={setPage}
            onLimitChange={setLimit}
            onFilterChange={setFilter}
        />
    );
}
