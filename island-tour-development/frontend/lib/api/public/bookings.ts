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

/** Lean backend TYP payload (`ThankYouResponseDto`). */
export interface TypResponse {
    publicRef: string;
    displayRef: string;
    status: string;
    tourId: string;
    tourName: string;
    island: string | null;
    localDate: string;
    startTime: string | null;
    endTime: string | null;
    timeZone: string | null;
    startsAtUtc: string | null;
    endsAtUtc: string | null;
    pickupAddress: string | null;
    partySize: number;
    currency: string;
    totalRetail: string;
    contactEmail: string | null;
    conversion: TypConversion | null;
}

/** Fetch the real TYP payload by public ref, or null if it can't be resolved. */
export function getTypByRef(publicRef: string): Promise<TypResponse | null> {
    return publicGet<TypResponse>(
        `/bookings/typ/${encodeURIComponent(publicRef)}`
    );
}
