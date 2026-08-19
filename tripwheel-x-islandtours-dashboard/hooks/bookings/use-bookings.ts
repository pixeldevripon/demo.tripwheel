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

/** Operator reports the OPERATOR_LINK balance unpaid (guide s15). */
export function useReportNonPayment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => bookingsDashboardApi.reportNonPayment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('Non-payment reported - an admin will review it.');
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to report non-payment.',
            ),
    });
}

/** Admin confirms the forfeit: deposit kept, spot released (guide s15). */
export function useConfirmForfeit() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => bookingsDashboardApi.confirmForfeit(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('Forfeit confirmed - deposit kept, spot released.');
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to confirm forfeit.',
            ),
    });
}

/** Admin dismisses a non-payment report (traveller paid after all). */
export function useDismissNonPayment() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => bookingsDashboardApi.dismissNonPayment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('Report dismissed - the booking stays confirmed.');
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to dismiss report.',
            ),
    });
}

/** Operator reports the traveller never turned up (PRD phase 3f). */
export function useReportNoShow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
            bookingsDashboardApi.reportNoShow(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('No-show reported - an admin will review it.');
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to report the no-show.',
            ),
    });
}

/** Admin confirms a no-show: records the fact, moves no money (PRD phase 3f). */
export function useConfirmNoShow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => bookingsDashboardApi.confirmNoShow(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('No-show confirmed - the deposit stays with us.');
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to confirm the no-show.',
            ),
    });
}

/** Admin dismisses a no-show report (the traveller did arrive). */
export function useDismissNoShow() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => bookingsDashboardApi.dismissNoShow(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('No-show report dismissed.');
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to dismiss the report.',
            ),
    });
}

/** Operator reports they must cancel (conflict #2) - the admin executes. */
export function useReportCancellation() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
            bookingsDashboardApi.reportCancellation(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success(
                'Cancellation reported - Island Tours will process the refund.',
            );
        },
        onError: err =>
            toast.error(
                err instanceof Error
                    ? err.message
                    : 'Failed to report the cancellation.',
            ),
    });
}

/** Admin dismisses an operator cancellation report (tour runs after all). */
export function useDismissCancellationReport() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) =>
            bookingsDashboardApi.dismissCancellationReport(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success('Report dismissed - the booking stays confirmed.');
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to dismiss report.',
            ),
    });
}

/** Admin restore of a mistakenly-cancelled booking (QA 2026-08-01). */
export function useRestoreBooking() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (id: string) => bookingsDashboardApi.restore(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: bookingKeys.all });
            toast.success(
                'Booking restored - seats re-booked and the traveller re-sent their confirmation.',
            );
        },
        onError: err =>
            toast.error(
                err instanceof Error ? err.message : 'Failed to restore booking.',
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
