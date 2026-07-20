/**
 * Server-side public read for the thank-you page (TYP). Hits the `@Public()`
 * backend endpoint `GET /bookings/typ/:publicRef` as the trusted SSR origin.
 *
 * The booking lookup is per-traveller data - UNCACHED by design; callers await it
 * inside a `<Suspense>` boundary after `connection()`. Returns null only on a
 * backend 404 (unknown ref) so the TYP can `notFound()` cleanly; when the backend
 * is unreachable it throws (`publicGetStrict`) and the error boundary renders -
 * a traveller with a real booking must never be told it does not exist.
 */
import 'server-only';
import { publicGetStrict } from './fetch';
import { TRAVELER_SESSION_HEADER } from '@/lib/traveler-session.shared';

/** Conversion payload (master booking_complete contract; value = EUR commission). */
export interface TypConversion {
    event: string;
    eventId: string;
    currency: string;
    value: string;
    contentId: string;
    contentName: string | null;
}

/** Operator contact (named deliberately post-booking - guide §13). */
export interface TypOperator {
    name: string | null;
    email: string | null;
    phone: string | null;
}

/** One grouped party line; `ageBandId` is null for UNIT-priced tours. */
export interface TypPartyLine {
    ageBandId: string | null;
    label: string;
    quantity: number;
}

/**
 * Backend TYP payload (`ThankYouResponseDto`). Raw values only - all labels are
 * locale-formatted on the frontend (`lib/thank-you/thank-you.ts`).
 */
export interface TypResponse {
    /**
     * True when the request carried a traveler session owning this booking.
     * False = masked mode: guest last name/email/phone masked, pickup address
     * and card details withheld (the bare publicRef link is view-only).
     */
    verified: boolean;
    publicRef: string;
    displayRef: string;
    status: string;
    /**
     * Cancellation state, decided server-side. `canRequestCancellation` is the
     * SAME predicate the submit endpoint enforces, so gate the cancel
     * affordance on it - never on `status` alone, or the page will keep
     * offering a request the API refuses (already requested, or departed).
     */
    cancellationRequestedAt: string | null;
    cancelledAt: string | null;
    canRequestCancellation: boolean;
    cancellationBlockedReason:
        | 'ALREADY_REQUESTED'
        | 'NOT_CONFIRMED'
        | 'DEPARTED'
        | null;
    tourId: string;
    tourName: string;
    island: string | null;
    /** Destination-LOCAL wall clock. Render against `timeZone`; never parse as UTC. */
    localDate: string;
    startTime: string | null;
    endTime: string | null;
    timeZone: string | null;
    /** Real UTC instants - ICS/reminders/integrations only, never display. */
    startsAtUtc: string | null;
    endsAtUtc: string | null;
    pickupAddress: string | null;
    pickupRequested: boolean;
    partySize: number;
    party: TypPartyLine[];
    guestFirstName: string | null;
    guestLastName: string | null;
    guestFullName: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    /** Charged currency (never the shopper cookie - guide §20.10). */
    currency: string;
    totalRetail: string;
    depositAmount: string;
    balanceAmount: string;
    paymentModel: string;
    paymentMethodBrand: string | null;
    paymentMethodLast4: string | null;
    durationMinutes: number | null;
    cancellationHours: number;
    freeCancellationDeadlineLocal: string | null;
    freeCancellationDeadlineUtc: string | null;
    operator: TypOperator;
    conversion: TypConversion | null;
}

/**
 * Fetch the real TYP payload by public ref, or null on a backend 404.
 * `sessionToken` (the HttpOnly traveler cookie, read server-side) unlocks the
 * unmasked payload; without it the backend returns masked mode. Uncached, so
 * the per-user header is safe here.
 */
export function getTypByRef(
    publicRef: string,
    sessionToken?: string | null
): Promise<TypResponse | null> {
    return publicGetStrict<TypResponse>(
        `/bookings/typ/${encodeURIComponent(publicRef)}`,
        sessionToken ? { [TRAVELER_SESSION_HEADER]: sessionToken } : undefined
    );
}
