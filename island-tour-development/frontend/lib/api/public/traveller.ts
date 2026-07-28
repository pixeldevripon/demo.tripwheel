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

/** One currency bucket of net spend (payments minus refunds). */
export interface TravellerSpend {
    currency: string;
    amount: string;
}

export interface TravellerSummary {
    bookingsCount: number;
    upcomingCount: number;
    /** Per currency - never summed across currencies. */
    totalSpend: TravellerSpend[];
}

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

/** Rows per page, shared by both tabs so their pagination reads the same. */
export const TRAVELLER_PAGE_SIZE = 10;

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

export function getTravellerSummary(
    sessionToken: string
): Promise<TravellerSummary | null> {
    return travellerGet<TravellerSummary>(
        '/bookings/traveller/summary',
        sessionToken
    );
}

export function getTravellerBookings(
    sessionToken: string,
    page = 1
): Promise<TravellerPage<TravellerBooking> | null> {
    return travellerGet<TravellerPage<TravellerBooking>>(
        `/bookings/traveller/bookings?page=${page}&limit=${TRAVELLER_PAGE_SIZE}`,
        sessionToken
    );
}

export function getTravellerPayments(
    sessionToken: string,
    page = 1
): Promise<TravellerPage<TravellerPayment> | null> {
    return travellerGet<TravellerPage<TravellerPayment>>(
        `/bookings/traveller/payments?page=${page}&limit=${TRAVELLER_PAGE_SIZE}`,
        sessionToken
    );
}
