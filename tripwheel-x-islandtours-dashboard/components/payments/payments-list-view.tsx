'use client';

import { useEffect, useState } from 'react';
import { usePayments } from '@/hooks/payments/use-payments';
import type {
    PaymentKind,
    PaymentStatus,
    PaymentsQueryParams,
} from '@/types/booking';
import { PaymentsTable } from './payments-table';

export function PaymentsListView() {
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(20);
    const [filters, setFilters] = useState<Record<string, string | undefined>>(
        {},
    );
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(search), 500);
        return () => clearTimeout(timer);
    }, [search]);

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

    function handleFilterChange(key: string, value: string | undefined) {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPage(1);
    }

    function handleLimitChange(newLimit: number) {
        setLimit(newLimit);
        setPage(1);
    }

    function handleSearchChange(value: string) {
        setSearch(value);
        setPage(1);
    }

    return (
        <div className='space-y-4'>
            <PaymentsTable
                data={data?.data ?? []}
                total={data?.total ?? 0}
                page={page}
                limit={limit}
                isLoading={isLoading}
                searchValue={search}
                onSearchChange={handleSearchChange}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
                onFilterChange={handleFilterChange}
            />
        </div>
    );
}
