import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { paymentsDashboardApi } from '@/lib/api/bookings-dashboard';
import type { PaymentsQueryParams } from '@/types/booking';

export const paymentKeys = {
    all: ['payments'] as const,
    list: (params: PaymentsQueryParams) =>
        [...paymentKeys.all, 'list', params] as const,
};

export function usePayments(params: PaymentsQueryParams = {}) {
    return useQuery({
        queryKey: paymentKeys.list(params),
        queryFn: () => paymentsDashboardApi.list(params),
        placeholderData: keepPreviousData,
    });
}
