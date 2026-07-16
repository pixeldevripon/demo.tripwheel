/**
 * Client-side reads against the public bookings endpoints (`@Public()` on the
 * backend). Currently only the server-authoritative price quote, called from the
 * booking widget on the user's live selection - so it uses the browser `apiFetch`,
 * not the server-only public fetch primitive.
 */
import type { Currency } from '@/lib/constants/locales';
import { apiFetch } from './fetch';

/** One priced row of a quote breakdown (age-band participant or add-on). */
export interface QuoteLine {
    kind: 'participant' | 'addon';
    ageBandId: string | null;
    label: string;
    quantity: number;
    /** Booking-currency amounts as strings (never floats). */
    unitPrice: string;
    lineTotal: string;
}

/**
 * Server-authoritative price quote (backend `BookingQuoteResponseDto`, guide
 * §20.4). Read-only preview with NO side effects - the reserve endpoint recomputes
 * the same math and is authoritative. All money is in `currency` (the shopper's
 * booking currency); `source*` mirrors the tour-currency quote for the FX audit.
 */
export interface BookingQuote {
    quoteId: string;
    /** ISO instant after which the quote should not be trusted for display. */
    expiresAt: string;
    tourCurrency: Currency;
    currency: Currency;
    sourceFxRateToBooking: string;
    fxRateToEur: string | null;
    sourceTotalRetail: string;
    totalRetail: string;
    sourceDepositAmount: string;
    depositAmount: string;
    sourceBalanceAmount: string;
    balanceAmount: string;
    commissionRate: string;
    commissionAmount: string | null;
    paymentModel: string;
    pax: number;
    lines: QuoteLine[];
}

/** Body for `POST /bookings/quote` (backend `QuoteBookingDto`). */
export interface QuoteRequest {
    tourId: string;
    departureId: string;
    /** PER_PERSON: one entry per age band with a count (spectators included). */
    items?: { ageBandId: string; quantity: number }[];
    /** UNIT (whole-unit / charter): total guest headcount instead of `items`. */
    guests?: number;
    /** Shopper (booking) currency; defaults to the tour currency server-side. */
    currency?: Currency;
    pickupLocationId?: string;
}

/**
 * Fetch a server-authoritative quote for a live widget selection. Throws (via
 * `apiFetch`) on a non-2xx response; the caller keeps its optimistic client
 * estimate on failure. Pass an `AbortSignal` to cancel a superseded request.
 */
export async function quoteBooking(
    req: QuoteRequest,
    signal?: AbortSignal
): Promise<BookingQuote> {
    return apiFetch<BookingQuote>('/bookings/quote', {
        method: 'POST',
        body: JSON.stringify(req),
        signal,
    });
}
