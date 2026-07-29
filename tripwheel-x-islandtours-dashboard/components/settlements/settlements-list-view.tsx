'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import { useRole } from '@/contexts/role-context';
import {
    useSettlementSummary,
    useSettlements,
} from '@/hooks/settlements/use-settlements';
import type { SettlementStatus, SettlementsQueryParams } from '@/types/booking';
import { SettlementsTable } from './settlements-table';

/**
 * Payout ledger, role-aware (founder 2026-07-26: both sides must read it
 * without guessing). ADMIN sees every operator + the manual mark-paid action;
 * an operator sees only their own rows, worded from their side ("due to you" /
 * "paid to you"). The summary cards use the exact same predicates as the
 * analytics payout card, so the figures always match.
 */
export function SettlementsListView() {
    const { role } = useRole();
    const isAdmin = role === 'ADMIN';
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
    const { data: summary } = useSettlementSummary();

    const params: SettlementsQueryParams = {
        page,
        limit,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(filters.status
            ? { status: filters.status as SettlementStatus }
            : {}),
        ...(isAdmin && filters.operatorId
            ? { operatorId: filters.operatorId }
            : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
    };

    const { data, isLoading } = useSettlements(params);

    return (
        <div className='space-y-4'>
            {summary && (
                <div className='grid grid-cols-2 gap-3 sm:max-w-md @4xl/main:max-w-xl'>
                    <div className='rounded-lg border border-line bg-surface-inset p-3'>
                        <p className='text-xs text-muted-foreground'>
                            {isAdmin
                                ? 'Payout due to operators'
                                : 'Due to you from Island Tours'}
                        </p>
                        <p className='text-lg font-medium tabular-nums'>
                            &euro;{summary.owedPending}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                            {summary.owedCount} payout
                            {summary.owedCount === 1 ? '' : 's'} not yet paid
                        </p>
                    </div>
                    <div className='rounded-lg border border-line bg-surface-inset p-3'>
                        <p className='text-xs text-muted-foreground'>
                            {isAdmin ? 'Paid out' : 'Paid to you'}
                        </p>
                        <p className='text-lg font-medium tabular-nums'>
                            &euro;{summary.released}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                            {summary.releasedCount} payout
                            {summary.releasedCount === 1 ? '' : 's'} completed
                        </p>
                    </div>
                </div>
            )}
            <SettlementsTable
                data={data?.data ?? []}
                total={data?.total ?? 0}
                page={page}
                limit={limit}
                isLoading={isLoading}
                isAdmin={isAdmin}
                searchValue={search}
                onSearchChange={setSearch}
                filters={filters}
                onPageChange={setPage}
                onLimitChange={setLimit}
                onFilterChange={setFilter}
            />
        </div>
    );
}

