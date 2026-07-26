import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { settlementsDashboardApi } from '@/lib/api/bookings-dashboard';
import { bookingKeys } from '@/hooks/bookings/use-bookings';
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

/**
 * Admin confirms the manual bank transfer happened (RECORDED -> PAID_OUT).
 * Invalidates the settlements lists + summary AND the bookings lists (booking
 * rows show the settlement badge), so every surface reflects the new state.
 */
export function useMarkSettlementPaid() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => settlementsDashboardApi.markPaid(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: settlementKeys.all });
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('Payout marked as paid.');
        },
        onError: err =>
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Failed to mark the payout as paid.',
            ),
    });
}

/** Admin reverts a mis-clicked mark-paid - the row returns to "Payout due". */
export function useMarkSettlementUnpaid() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => settlementsDashboardApi.markUnpaid(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: settlementKeys.all });
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('Payout reverted to due.');
        },
        onError: err =>
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Failed to revert the payout.',
            ),
    });
}
