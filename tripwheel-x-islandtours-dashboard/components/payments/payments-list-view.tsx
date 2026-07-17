'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { usePayments } from '@/hooks/payments/use-payments';
import type {
    PaymentKind,
    PaymentStatus,
    PaymentsQueryParams,
} from '@/types/booking';
import { PaymentsTable } from './payments-table';

export function PaymentsListView() {
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

    const params: PaymentsQueryParams = {
        page,
        limit,
        ...(filters.status ? { status: filters.status as PaymentStatus } : {}),
        ...(filters.kind ? { kind: filters.kind as PaymentKind } : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
    };

    const { data, isLoading } = usePayments(params);




    return (
        <div className='space-y-4'>
            <PaymentsTable
                data={data?.data ?? []}
                total={data?.total ?? 0}
                page={page}
                limit={limit}
                isLoading={isLoading}
                filters={filters}
                searchValue={search}
                onSearchChange={setSearch}
                onPageChange={setPage}
                onLimitChange={setLimit}
                onFilterChange={setFilter}
            />
        </div>
    );
}
