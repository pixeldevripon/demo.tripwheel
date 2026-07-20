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
    summary: () => [...bookingKeys.all, 'me-summary'] as const,
};

export function useBookings(params: BookingsQueryParams = {}, enabled = true) {
    return useQuery({
        queryKey: bookingKeys.list(params),
        queryFn: () => bookingsDashboardApi.list(params),
        enabled,
        placeholderData: keepPreviousData,
    });
}

/** Customer stat row (GET /bookings/me/summary) - self-scoped server-side. */
export function useCustomerBookingSummary(enabled = true) {
    return useQuery({
        queryKey: bookingKeys.summary(),
        queryFn: () => bookingsDashboardApi.getMyBookingSummary(),
        enabled,
    });
}

/**
 * Customer cancellation REQUEST - emails the admin, never cancels on click.
 * Invalidates the lists so the "Cancellation requested" state shows at once.
 */
export function useRequestCancellation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
            bookingsDashboardApi.requestCancellation(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success(
                "Cancellation requested - we'll email you once it is processed.",
            );
        },
        onError: err =>
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Failed to request cancellation.',
            ),
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
