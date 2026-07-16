/**
 * Server-side public read for the thank-you page (TYP). Hits the `@Public()`
 * backend endpoint `GET /bookings/typ/:publicRef` as the trusted SSR origin.
 *
 * The booking lookup is per-traveller data - UNCACHED by design; callers await it
 * inside a `<Suspense>` boundary after `connection()`. Returns null on any failure
 * (unknown ref / non-2xx) so the TYP can `notFound()` cleanly.
 */
import 'server-only';
import { publicGet } from './fetch';

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
    publicRef: string;
    displayRef: string;
    status: string;
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

/** Fetch the real TYP payload by public ref, or null if it can't be resolved. */
export function getTypByRef(publicRef: string): Promise<TypResponse | null> {
    return publicGet<TypResponse>(
        `/bookings/typ/${encodeURIComponent(publicRef)}`
    );
}
