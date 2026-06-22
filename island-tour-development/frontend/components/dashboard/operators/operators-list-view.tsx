'use client';

import { useEffect, useState } from 'react';
import { OperatorsTable } from './operators-table';
import { useOperators } from '@/hooks/operators/use-operators';

export function OperatorsListView() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Debounce the search input before hitting the API.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useOperators({
    page,
    limit,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(statusFilter !== 'all' ? { isActive: statusFilter === 'active' } : {}),
  });

  function handleLimitChange(newLimit: number) {
    setLimit(newLimit);
    setPage(1);
  }

  function handleStatusFilterChange(value: string) {
    setStatusFilter(value);
    setPage(1);
  }

  return (
    <OperatorsTable
      data={data?.data ?? []}
      total={data?.total ?? 0}
      page={page}
      limit={limit}
      isLoading={isLoading}
      search={search}
      statusFilter={statusFilter}
      onSearchChange={setSearch}
      onPageChange={setPage}
      onLimitChange={handleLimitChange}
      onStatusFilterChange={handleStatusFilterChange}
    />
  );
}
