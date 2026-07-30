/**
 * Server-side reads for the traveller account area (`/{locale}/traveller`).
 *
 * Every call carries the HttpOnly traveler session as `x-traveler-session`, so
 * these are PER-USER and must never be wrapped in `'use cache'` - the response
 * would be cached under a shared key and leak one traveller's bookings to the
 * next visitor. Callers await them inside a `<Suspense>` boundary after
 * `connection()`, exactly like the TYP read.
 *
 * A 401 is a normal outcome here, not an error: it means "no session, an
 * expired one, or a weaker (pair-login / checkout) token". It maps to `null`
 * so the page can render the login card instead of an error boundary. Only a
 * genuinely unreachable backend throws.
 */
import 'server-only';
import { BackendUnavailableError, publicFetch } from './fetch';
import { TRAVELER_SESSION_HEADER } from '@/lib/traveler-session.shared';
import type { PaymentModel } from '@/types/trip';

/**
 * One booking on the account area. Server verdicts (`canRequestCancellation`,
 * `cancellationBlockedReason`, `requestedInFreeWindow`, `canReview`) are
 * rendered as-is: the start time is a local wall clock and means nothing
 * without the tour timezone, so re-deriving them client-side gets them wrong.
 */
export interface TravellerBooking {
    id: string;
    displayRef: string;
    publicRef: string;
    /** The raw enum, for logic. Chips render `displayStatus` instead. */
    status: string;
    displayStatus: string;
    localDate: string;
    startTime: string | null;
    currency: string;
    totalRetail: string;
    depositAmount: string;
    balanceAmount: string;
    paymentModel: PaymentModel;
    paymentStatus: 'PAID' | 'PARTIALLY_PAID' | 'UNPAID' | 'REFUNDED';
    paidAmount: string;
    refundStatus: 'NONE' | 'PENDING' | 'PARTIAL' | 'REFUNDED';
    tourName: string;
    partySize: number;
    createdAt: string;
    utcConfirmedAt: string | null;
    utcCancellationRequestedAt: string | null;
    freeCancelDeadline: string | null;
    requestedInFreeWindow: boolean | null;
    canRequestCancellation: boolean;
    cancellationBlockedReason:
        | 'ALREADY_REQUESTED'
        | 'NOT_CONFIRMED'
        | 'DEPARTED'
        | null;
    /** For the manage deep-link `/{destinationSlug}/thank-you/{publicRef}`. */
    destinationSlug: string | null;
    /** Display name for the card meta row ("· Curaçao"). */
    destinationName: string | null;
    /** For the canonical tour page link `/{destinationSlug}/{tourSlug}/`. */
    tourSlug: string;
    tourImageUrl: string | null;
    durationMinutesFrom: number | null;
    /** Master 4.4 "be there N minutes early" (pickup lead time or check-in buffer). */
    arrivalBufferMinutes: number | null;
    /** Locale-preferred meeting point - same source chain as the confirmation email. */
    meetingPoint: string | null;
    meetingPointLat: number | null;
    meetingPointLng: number | null;
    pickupAddress: string | null;
    pickupWindowStart: string | null;
    pickupWindowEnd: string | null;
    onArrivalPayment: 'CARD_OR_CASH' | 'CASH_ONLY' | null;
    /** Support row (review 5.8): operator first, WhatsApp fallback. */
    operator: {
        name: string | null;
        email: string | null;
        phone: string | null;
    };
    review: {
        reviewed: boolean;
        canReview: boolean;
        reviewToken: string | null;
    };
}

/** One charge or refund. Traveler-safe: no provider ids, no payout context. */
export interface TravellerPayment {
    id: string;
    kind: 'DEPOSIT' | 'BALANCE' | 'FULL' | 'REFUND';
    status: string;
    provider: string;
    methodType: string | null;
    /** Card brand + last4 from the booking's payment-method snapshot (F14). */
    methodBrand: string | null;
    methodLast4: string | null;
    amount: string;
    currency: string;
    createdAt: string;
    bookingDisplayRef: string;
    bookingPublicRef: string;
    destinationSlug: string | null;
    tourName: string | null;
    bookingLocalDate: string;
}

export interface TravellerPage<T> {
    total: number;
    page: number;
    limit: number;
    data: T[];
}

/** One per-currency ledger subtotal - never summed across currencies. */
export interface TravellerLedgerBucket {
    currency: string;
    amount: string;
}

/** Ledger subtotal chips (review 5.7): paid / refunded / still in flight. */
export interface TravellerLedgerTotals {
    paid: TravellerLedgerBucket[];
    refunded: TravellerLedgerBucket[];
    refundPending: TravellerLedgerBucket[];
}

export interface TravellerPaymentsPage extends TravellerPage<TravellerPayment> {
    totals: TravellerLedgerTotals;
}

/**
 * One payment as a printable RECEIPT (review 9a). Deliberately a receipt, not
 * a tax invoice - the platform holds no VAT breakdown. The only traveller
 * payload carrying the payer name (the caller IS that person).
 */
export interface TravellerReceipt {
    id: string;
    kind: 'DEPOSIT' | 'BALANCE' | 'FULL' | 'REFUND';
    status: string;
    amount: string;
    currency: string;
    createdAt: string;
    methodType: string | null;
    methodBrand: string | null;
    methodLast4: string | null;
    payerName: string | null;
    bookingDisplayRef: string;
    bookingPublicRef: string;
    bookingLocalDate: string;
    startTime: string | null;
    tourName: string | null;
    destinationName: string | null;
    destinationSlug: string | null;
    operatorName: string | null;
}

/** Rows per page on the payments ledger. */
export const TRAVELLER_PAGE_SIZE = 10;

/**
 * The bookings tab fetches up to the backend cap in one read: the page groups
 * Upcoming / Past / Cancelled and pins the next trip on top (review 5.2-5.3),
 * which only works when the grouping sees the whole account. Pagination still
 * kicks in past 50 bookings - rare enough that a second page of groups beats
 * per-group pagination machinery.
 */
export const TRAVELLER_BOOKINGS_PAGE_SIZE = 50;

/**
 * GET a traveller account endpoint. Returns null on 401 ("show the login
 * card"), throws only when the backend cannot be reached at all.
 */
async function travellerGet<T>(
    path: string,
    sessionToken: string
): Promise<T | null> {
    let res: Response;
    try {
        res = await publicFetch(path, {
            [TRAVELER_SESSION_HEADER]: sessionToken,
        });
    } catch (err) {
        throw new BackendUnavailableError(
            path,
            err instanceof Error ? err.message : 'network error'
        );
    }
    if (res.status === 401) return null;
    if (!res.ok) throw new BackendUnavailableError(path, `HTTP ${res.status}`);
    try {
        return (await res.json()) as T;
    } catch {
        throw new BackendUnavailableError(path, 'invalid JSON body');
    }
}

// NOTE: the backend also serves /bookings/traveller/summary; this app stopped
// reading it when the stat tiles were replaced by the next-trip module
// (review F5) - the dashboard's customer summary still uses the shared math.

export function getTravellerBookings(
    sessionToken: string,
    page = 1,
    locale?: string
): Promise<TravellerPage<TravellerBooking> | null> {
    const localeParam = locale ? `&locale=${locale}` : '';
    return travellerGet<TravellerPage<TravellerBooking>>(
        `/bookings/traveller/bookings?page=${page}&limit=${TRAVELLER_BOOKINGS_PAGE_SIZE}${localeParam}`,
        sessionToken
    );
}

export function getTravellerPayments(
    sessionToken: string,
    page = 1
): Promise<TravellerPaymentsPage | null> {
    return travellerGet<TravellerPaymentsPage>(
        `/bookings/traveller/payments?page=${page}&limit=${TRAVELLER_PAGE_SIZE}`,
        sessionToken
    );
}

/** Null on 401 (login card) AND on 404 (not this traveller's payment). */
export async function getTravellerReceipt(
    sessionToken: string,
    paymentId: string
): Promise<TravellerReceipt | null> {
    try {
        return await travellerGet<TravellerReceipt>(
            `/bookings/traveller/payments/${encodeURIComponent(paymentId)}`,
            sessionToken
        );
    } catch (err) {
        // A malformed/unknown id 404s; that is "no receipt", not an outage.
        if (
            err instanceof BackendUnavailableError &&
            err.message.includes('HTTP 404')
        ) {
            return null;
        }
        throw err;
    }
}
