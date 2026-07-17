'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { OperatorsTable } from './operators-table';
import { useOperators } from '@/hooks/operators/use-operators';

export function OperatorsListView() {
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
  const statusFilter = filters.isActive ?? 'all';

  const { data, isLoading } = useOperators({
    page,
    limit,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(statusFilter !== 'all' ? { isActive: statusFilter === 'active' } : {}),
  });



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
      onLimitChange={setLimit}
      onStatusFilterChange={(v) => setFilter('isActive', v === 'all' ? undefined : v)}
    />
  );
}
