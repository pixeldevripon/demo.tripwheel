'use client';

import { useTableState } from '@/components/data-table/use-table-state';
import {
    useSettlementSummary,
    useSettlements,
} from '@/hooks/settlements/use-settlements';
import type {
    BookingPaymentModel,
    SettlementStatus,
    SettlementsQueryParams,
} from '@/types/booking';
import { SettlementsTable } from './settlements-table';

export function SettlementsListView() {
    const { page, limit, filters, setPage, setLimit, setFilter } =
        useTableState();
    const { data: summary } = useSettlementSummary();

    const params: SettlementsQueryParams = {
        page,
        limit,
        ...(filters.status
            ? { status: filters.status as SettlementStatus }
            : {}),
        ...(filters.paymentModel
            ? { paymentModel: filters.paymentModel as BookingPaymentModel }
            : {}),
        ...(filters.from ? { from: filters.from } : {}),
        ...(filters.to ? { to: filters.to } : {}),
    };

    const { data, isLoading } = useSettlements(params);

    return (
        <div className='space-y-4'>
            {summary && (
                <div className='grid grid-cols-2 gap-3 sm:max-w-md'>
                    <div className='rounded-lg border border-line bg-surface-inset p-3'>
                        <p className='text-xs text-muted-foreground'>
                            Owed to operators (pending)
                        </p>
                        <p className='text-lg font-semibold tabular-nums'>
                            &euro;{summary.owedPending}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                            {summary.owedCount} payout
                            {summary.owedCount === 1 ? '' : 's'} awaiting release
                        </p>
                    </div>
                    <div className='rounded-lg border border-line bg-surface-inset p-3'>
                        <p className='text-xs text-muted-foreground'>Released</p>
                        <p className='text-lg font-semibold tabular-nums'>
                            &euro;{summary.released}
                        </p>
                        <p className='text-xs text-muted-foreground'>
                            {summary.releasedCount} paid out
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
                filters={filters}
                onPageChange={setPage}
                onLimitChange={setLimit}
                onFilterChange={setFilter}
            />
        </div>
    );
}
