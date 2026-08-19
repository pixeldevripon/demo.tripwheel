'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { DestinationsTable } from './destinations-table';
import { useDestinations } from '@/hooks/destinations/use-destinations';

export function DestinationsListView() {
    const { page, limit, filters, setPage, setLimit, setFilter } =
        useTableState();

    // isActive default is ACTIVE; 'all' in the URL means no filter.
    const isActiveParam =
        filters.isActive === 'all'
            ? {}
            : { isActive: (filters.isActive ?? 'true') === 'true' };

    const { data, isLoading } = useDestinations({
        page,
        limit,
        locale: 'en',
        ...isActiveParam,
    });

    return (
        <DestinationsTable
            data={data?.data ?? []}
            total={data?.total ?? 0}
            page={page}
            limit={limit}
            isLoading={isLoading}
            filters={filters}
            onPageChange={setPage}
            onLimitChange={setLimit}
            onFilterChange={setFilter}
        />
    );
}
