import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { settlementsDashboardApi } from '@/lib/api/bookings-dashboard';
import type { SettlementsQueryParams } from '@/types/booking';

export const settlementKeys = {
    all: ['settlements'] as const,
    list: (params: SettlementsQueryParams) =>
        [...settlementKeys.all, 'list', params] as const,
};

export function useSettlements(params: SettlementsQueryParams = {}) {
    return useQuery({
        queryKey: settlementKeys.list(params),
        queryFn: () => settlementsDashboardApi.list(params),
        placeholderData: keepPreviousData,
    });
}

export function useSettlementSummary() {
    return useQuery({
        queryKey: [...settlementKeys.all, 'summary'] as const,
        queryFn: () => settlementsDashboardApi.summary(),
    });
}
