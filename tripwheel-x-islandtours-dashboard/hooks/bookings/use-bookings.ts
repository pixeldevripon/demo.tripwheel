import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { bookingsDashboardApi } from '@/lib/api/bookings-dashboard';
import type {
    BookingsQueryParams,
    CancelBookingPayload,
} from '@/types/booking';

export const bookingKeys = {
    all: ['bookings'] as const,
    list: (params: BookingsQueryParams) =>
        [...bookingKeys.all, 'list', params] as const,
};

export function useBookings(params: BookingsQueryParams = {}, enabled = true) {
    return useQuery({
        queryKey: bookingKeys.list(params),
        queryFn: () => bookingsDashboardApi.list(params),
        enabled,
        placeholderData: keepPreviousData,
    });
}

/** Admin "mark cancelled" (master 6.4) - invalidates every bookings list. */
export function useCancelBooking() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            id,
            payload,
        }: {
            id: string;
            payload?: CancelBookingPayload;
        }) => bookingsDashboardApi.cancel(id, payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('Booking cancelled.');
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to cancel booking.',
            ),
    });
}
