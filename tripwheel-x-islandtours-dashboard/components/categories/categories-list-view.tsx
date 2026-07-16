'use client';

import { useState } from 'react';
import { CategoriesTable } from './categories-table';
import { useCategories } from '@/hooks/categories/use-categories';

export function CategoriesListView() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [filters, setFilters] = useState<Record<string, string | undefined>>({ isActive: 'true' });

  const { data, isLoading } = useCategories({
    page,
    limit,
    locale: 'en',
    ...(filters.isActive !== undefined ? { isActive: filters.isActive === 'true' } : {}),
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
    <CategoriesTable
      data={data?.data ?? []}
      total={data?.total ?? 0}
      page={page}
      limit={limit}
      isLoading={isLoading}
      onPageChange={setPage}
      onLimitChange={handleLimitChange}
      onFilterChange={handleFilterChange}
    />
  );
}
