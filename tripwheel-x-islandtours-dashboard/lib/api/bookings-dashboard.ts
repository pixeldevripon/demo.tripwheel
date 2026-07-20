/**
 * Dashboard (authed) booking + payment API clients. The PUBLIC booking client
 * (quote / reserve / TYP / cancellation-request) lives in `lib/api/bookings.ts`;
 * this file is the operator/admin surface behind `VIEW_BOOKINGS`/`VIEW_PAYMENTS`.
 */
import type {
    BookingListItem,
    BookingsQueryParams,
    CancelBookingPayload,
    CustomerBookingSummary,
    PaginatedBookings,
    PaginatedPayments,
    PaymentsQueryParams,
} from '@/types/booking';
import { apiFetch } from './fetch';

function buildQuery(
    params: object,
): string {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params) as Array<
        [string, string | number | boolean | undefined | null]
    >) {
        if (value !== undefined && value !== null && value !== '') {
            qs.set(key, String(value));
        }
    }
    const str = qs.toString();
    return str ? `?${str}` : '';
}

export const bookingsDashboardApi = {
    /** Scoped server-side: admin sees all, operators their own tours' bookings. */
    list(params: BookingsQueryParams = {}): Promise<PaginatedBookings> {
        return apiFetch<PaginatedBookings>(`/bookings${buildQuery(params)}`);
    },

    /**
     * Admin "mark cancelled" (master 6.4). Refund eligibility stays judged at
     * the traveller's request instant - the backend defaults `requestedAt` to
     * the stored request stamp, so we never send a timestamp from the client.
     */
    cancel(id: string, payload: CancelBookingPayload = {}): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(`/bookings/${id}/cancel`, {
            method: 'POST',
            body: JSON.stringify(payload),
        });
    },

    /** Customer stat row - always the caller's OWN bookings (self-scoped). */
    getMyBookingSummary(): Promise<CustomerBookingSummary> {
        return apiFetch<CustomerBookingSummary>('/bookings/me/summary');
    },

    /**
     * Customer cancellation REQUEST (never cancels on click - the admin
     * processes it). Ownership enforced server-side via booking.userId.
     */
    requestCancellation(
        id: string,
        reason?: string,
    ): Promise<{ requested: boolean }> {
        return apiFetch<{ requested: boolean }>(
            `/bookings/${id}/cancellation-request`,
            {
                method: 'POST',
                body: JSON.stringify(reason?.trim() ? { reason } : {}),
            },
        );
    },
};

export const paymentsDashboardApi = {
    /** Scoped server-side like bookings; requires VIEW_PAYMENTS. */
    list(params: PaymentsQueryParams = {}): Promise<PaginatedPayments> {
        return apiFetch<PaginatedPayments>(`/payments${buildQuery(params)}`);
    },
};
