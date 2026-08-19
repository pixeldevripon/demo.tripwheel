/**
 * Dashboard (authed) booking + payment API clients. The PUBLIC booking client
 * (quote / reserve / TYP / cancellation-request) lives in `lib/api/bookings.ts`;
 * this file is the operator/admin surface behind `VIEW_BOOKINGS`/`VIEW_PAYMENTS`.
 */
import type {
    BookingListItem,
    BookingsQueryParams,
    CancelBookingPayload,
    PaginatedBookings,
    PaginatedPayments,
    PaginatedSettlements,
    PaymentsQueryParams,
    SettlementActionResult,
    SettlementSummary,
    SettlementsQueryParams,
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

    /**
     * Admin restore of a mistakenly-cancelled booking (QA 2026-08-01): seats
     * re-taken (guarded - the backend refuses if they were resold), booking
     * back to CONFIRMED, settlement reinstated, confirmation email re-sent.
     * Refused once a refund settled or is in flight.
     */
    restore(id: string): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(`/bookings/${id}/restore`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    // ── Non-payment forfeit (guide s15) ─────────────────────────────────────

    /** Operator reports the OPERATOR_LINK balance unpaid (idempotent stamp). */
    reportNonPayment(id: string): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(`/bookings/${id}/report-non-payment`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    /** Admin confirms the forfeit: deposit kept, spot released. NO refund. */
    confirmForfeit(id: string): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(`/bookings/${id}/forfeit`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    /** Admin dismisses a report (traveller paid after all). */
    dismissNonPayment(id: string): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(`/bookings/${id}/dismiss-non-payment`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    // ── No-show (PRD phase 3f) ──────────────────────────────────────────────

    /** Operator reports the traveller never turned up (idempotent stamp). */
    reportNoShow(id: string, reason?: string): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(`/bookings/${id}/report-no-show`, {
            method: 'POST',
            body: JSON.stringify(reason ? { reason } : {}),
        });
    },

    /** Admin confirms the no-show. Records the fact; moves no money. */
    confirmNoShow(id: string): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(`/bookings/${id}/confirm-no-show`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    /** Admin dismisses a no-show report (the traveller did arrive). */
    dismissNoShow(id: string): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(`/bookings/${id}/dismiss-no-show`, {
            method: 'POST',
            body: JSON.stringify({}),
        });
    },

    // ── Operator cancellation report (conflict #2) ──────────────────────────

    /** Operator reports they must cancel - the admin executes the refund. */
    reportCancellation(id: string, reason?: string): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(
            `/bookings/${id}/report-cancellation`,
            {
                method: 'POST',
                body: JSON.stringify(reason?.trim() ? { reason } : {}),
            },
        );
    },

    /** Admin dismisses an operator cancellation report (tour runs after all). */
    dismissCancellationReport(id: string): Promise<BookingListItem> {
        return apiFetch<BookingListItem>(
            `/bookings/${id}/dismiss-cancellation-report`,
            { method: 'POST', body: JSON.stringify({}) },
        );
    },

};

export const paymentsDashboardApi = {
    /** Scoped server-side like bookings; requires VIEW_PAYMENTS. */
    list(params: PaymentsQueryParams = {}): Promise<PaginatedPayments> {
        return apiFetch<PaginatedPayments>(`/payments${buildQuery(params)}`);
    },
};

export const settlementsDashboardApi = {
    /** Operator-payout ledger. Admin sees all (operator-filterable); operator scoped server-side. VIEW_PAYMENTS. */
    list(params: SettlementsQueryParams = {}): Promise<PaginatedSettlements> {
        return apiFetch<PaginatedSettlements>(
            `/settlements${buildQuery(params)}`,
        );
    },
    /** Roll-up: EUR payout due vs actually paid out. Same scoping as list(). */
    summary(): Promise<SettlementSummary> {
        return apiFetch<SettlementSummary>('/settlements/summary');
    },
    /** Admin confirms the manual transfer happened (RECORDED -> PAID_OUT). MANAGE_BOOKINGS. */
    markPaid(id: string): Promise<SettlementActionResult> {
        return apiFetch<SettlementActionResult>(
            `/settlements/${id}/mark-paid`,
            { method: 'PATCH' },
        );
    },
    /** Admin reverts a mis-clicked mark-paid (PAID_OUT -> RECORDED). MANAGE_BOOKINGS. */
    markUnpaid(id: string): Promise<SettlementActionResult> {
        return apiFetch<SettlementActionResult>(
            `/settlements/${id}/mark-unpaid`,
            { method: 'PATCH' },
        );
    },
};
