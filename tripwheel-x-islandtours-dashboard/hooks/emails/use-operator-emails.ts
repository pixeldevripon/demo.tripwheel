'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { emailsApi } from '@/lib/api/emails';

export const emailKeys = {
    all: ['emails'] as const,
    operator: (operatorId: string) =>
        [...emailKeys.all, 'operator', operatorId] as const,
    booking: (bookingId: string) =>
        [...emailKeys.all, 'booking', bookingId] as const,
};

/** Send-log timeline for an operator (onboarding + internal rows). */
export function useOperatorEmails(operatorId: string, enabled = true) {
    return useQuery({
        queryKey: emailKeys.operator(operatorId),
        queryFn: () => emailsApi.listForOperator(operatorId),
        enabled: enabled && !!operatorId,
    });
}

/** Send-log timeline for a booking (BK/CX rows). */
export function useBookingEmails(bookingId: string, enabled = true) {
    return useQuery({
        queryKey: emailKeys.booking(bookingId),
        queryFn: () => emailsApi.listForBooking(bookingId),
        enabled: enabled && !!bookingId,
    });
}

/**
 * Admin resend of an onboarding email (WP-D endpoint). Invalidates the
 * operator's timeline so the new `#resend-{n}` row appears immediately.
 */
export function useResendEmail() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({
            operatorId,
            templateKey,
        }: {
            operatorId: string;
            templateKey: string;
        }) => emailsApi.resend(operatorId, templateKey),
        onSuccess: (_data, { operatorId }) => {
            queryClient.invalidateQueries({
                queryKey: emailKeys.operator(operatorId),
            });
        },
    });
}
