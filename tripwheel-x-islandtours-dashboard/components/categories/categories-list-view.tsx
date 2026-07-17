'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { CategoriesTable } from './categories-table';
import { useCategories } from '@/hooks/categories/use-categories';

export function CategoriesListView() {
    const { page, limit, filters, setPage, setLimit, setFilter } =
        useTableState();

    // isActive default is ACTIVE; 'all' in the URL means no filter.
    const isActiveParam =
        filters.isActive === 'all'
            ? {}
            : { isActive: (filters.isActive ?? 'true') === 'true' };

    const { data, isLoading } = useCategories({
        page,
        limit,
        locale: 'en',
        ...isActiveParam,
    });

    return (
        <CategoriesTable
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
