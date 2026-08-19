'use client';

import { useMemo } from 'react';
import { useTableState } from '@/components/data-table/use-table-state';
import { OperatorsTable } from './operators-table';
import { useOperators } from '@/hooks/operators/use-operators';
import type { OperatorVerificationStatus } from '@/types/operator';

import {
  type OperatorFacet,
  VERIFICATION_FILTER_VALUES,
} from './operator-filters';

// Re-exported for existing consumers of the list view's types.
export type { OperatorFacet };

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
  // Server-side filter - the backend list API validates ?verificationStatus=.
  const verificationFilter = (
    VERIFICATION_FILTER_VALUES as readonly OperatorVerificationStatus[]
  ).includes(filters.verificationStatus as OperatorVerificationStatus)
    ? (filters.verificationStatus as OperatorVerificationStatus)
    : 'all';
  const facet =
    filters.facet === 'zeroTours' || filters.facet === 'firstTourLive'
      ? (filters.facet as OperatorFacet)
      : undefined;

  const { data, isLoading } = useOperators({
    page,
    limit,
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(statusFilter !== 'all' ? { isActive: statusFilter === 'active' } : {}),
    ...(verificationFilter !== 'all'
      ? { verificationStatus: verificationFilter }
      : {}),
  });

  // The "0 tours" / "first tour live" facets are CLIENT-SIDE, applied to the
  // fetched page: the list API exposes the fields (toursSubmitted,
  // firstTourLiveAt) but no filter params for them. Row counts shrink while
  // the pager still reflects the unfaceted server total - declared tradeoff.
  const rows = useMemo(() => {
    const all = data?.data ?? [];
    if (facet === 'zeroTours') return all.filter((o) => o.toursSubmitted === 0);
    if (facet === 'firstTourLive')
      return all.filter((o) => o.firstTourLiveAt != null);
    return all;
  }, [data, facet]);

  return (
    <OperatorsTable
      data={rows}
      total={data?.total ?? 0}
      page={page}
      limit={limit}
      isLoading={isLoading}
      search={search}
      statusFilter={statusFilter}
      verificationFilter={verificationFilter}
      facet={facet}
      onSearchChange={setSearch}
      onPageChange={setPage}
      onLimitChange={setLimit}
      onStatusFilterChange={(v) => setFilter('isActive', v === 'all' ? undefined : v)}
      onVerificationFilterChange={(v) =>
        setFilter('verificationStatus', v === 'all' ? undefined : v)
      }
      onFacetChange={(v) => setFilter('facet', v)}
    />
  );
}
