'use client';

import { useMemo } from 'react';
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

    // The taxonomy is a small FIXED set (the locked 19 + filter-only
    // sub-categories), so fetch it whole: the list nests each sub-category
    // under its parent's row, and server paging could split a family across
    // pages. 100 is the endpoint's cap and several times the real count.
    const { data, isLoading } = useCategories({
        page: 1,
        limit: 100,
        locale: 'en',
        ...isActiveParam,
    });

    // Only PARENT categories are rows; their sub-categories ride along and
    // render inside the row (client decision 2026-08-15 - a flat mixed list
    // hid what was a sub-category at a glance).
    const parents = useMemo(() => {
        const all = data?.data ?? [];
        return all
            .filter(c => !c.parentCategoryId)
            .map(c => ({
                ...c,
                subCategories: all.filter(s => s.parentCategoryId === c.id),
            }));
    }, [data]);

    return (
        <CategoriesTable
            data={parents}
            total={parents.length}
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
