/**
 * Client-side calls against the public bookings + payments endpoints (`@Public()`
 * on the backend), driven from the browser: the live price quote (booking widget),
 * and the checkout reserve → contact → payment-intent flow. All use the browser
 * `apiFetch` (session cookie for attribution), not the server-only public fetch.
 *
 * The TYP read (`GET /bookings/typ/:publicRef`) is exposed both here (client, for
 * the /payment/processing status poll) and server-side in `lib/api/public/bookings.ts`
 * (for the prerendered TYP page).
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

// ── Reserve → contact → payment intent (checkout) ───────────────────────────

/** One party line for a PER_PERSON reserve (backend `ReserveItemDto`). */
export interface ReserveItem {
    ageBandId: string;
    quantity: number;
    travelerAge?: number;
}

/** Body for `POST /bookings` (backend `ReserveBookingDto`). */
export interface ReserveRequest {
    /** Client-supplied idempotency key - a retried reserve returns the same booking. */
    id?: string;
    tourId: string;
    departureId: string;
    /** PER_PERSON: one entry per age band (required). Omit for UNIT. */
    items?: ReserveItem[];
    /** UNIT (whole-unit / charter): total guest headcount instead of `items`. */
    guests?: number;
    /** Shopper (booking) currency; defaults to the tour currency server-side. */
    currency?: Currency;
    /** Server quote id (forward-compat; reserve recomputes and is authoritative). */
    quoteId?: string;
    pickupRequested?: boolean;
    pickupLocationId?: string;
    notes?: string;
    newsletterOptIn?: boolean;
}

/** Contact block for `PATCH /bookings/:id` (backend `ContactDto`). */
export interface BookingContact {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    postalCode?: string;
    country?: string;
    locales?: string[];
}

/** A reserved booking (backend `BookingResponseDto`) - the subset checkout uses. */
export interface ReservedBooking {
    id: string;
    displayRef: string;
    publicRef: string;
    tourId: string;
    departureId: string | null;
    status: string;
    currency: string;
    totalRetail: string;
    depositAmount: string;
    balanceAmount: string;
    paymentModel: string;
}

/** Response of `POST /payments/bookings/:id/intent` (backend `PaymentIntentResponseDto`). */
export interface PaymentIntentResult {
    /** False only when nothing is due now (OPERATOR_FULL) - skip the card step. */
    paymentRequired: boolean;
    clientSecret?: string;
    publishableKey?: string;
    /** Amount charged now, in the booking currency (string, never a float). */
    amount?: string;
    currency?: Currency;
    kind?: string;
    status?: string;
    /** Eligible methods (account-activated + currency-compatible). Checkout offers only these. */
    paymentMethodTypes?: string[];
}

/** Thank-you-page payload (backend `ThankYouResponseDto`; TYP + processing poll). */
export interface ThankYouConversion {
    event: string;
    eventId: string;
    currency: string;
    value: string;
    contentId: string;
    contentName: string | null;
}

export interface ThankYouBooking {
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
    conversion: ThankYouConversion | null;
}

/**
 * Reserve a booking (holds seats, `ON_HOLD`). Idempotent on `req.id` - a retried
 * reserve with the same id returns the existing booking, so the checkout can safely
 * re-submit (e.g. after going back to edit contact).
 */
export async function reserveBooking(
    req: ReserveRequest
): Promise<ReservedBooking> {
    return apiFetch<ReservedBooking>('/bookings', {
        method: 'POST',
        body: JSON.stringify(req),
    });
}

/** Attach/refresh the contact block on a reserved booking (before payment). */
export async function updateBookingContact(
    bookingId: string,
    contact: BookingContact,
    notes?: string
): Promise<ReservedBooking> {
    return apiFetch<ReservedBooking>(`/bookings/${bookingId}`, {
        method: 'PATCH',
        body: JSON.stringify({ contact, ...(notes ? { notes } : {}) }),
    });
}

/**
 * Create (or fetch, idempotently) the up-front PaymentIntent for a booking. Returns
 * `paymentRequired: false` when nothing is due now; otherwise a `clientSecret` +
 * `publishableKey` to drive Stripe.js.
 */
export async function createPaymentIntent(
    bookingId: string
): Promise<PaymentIntentResult> {
    return apiFetch<PaymentIntentResult>(
        `/payments/bookings/${bookingId}/intent`,
        { method: 'POST' }
    );
}

/**
 * Read the thank-you payload by public ref (client-side - used by the
 * /payment/processing poller to watch for the webhook `CONFIRMED` transition).
 */
export async function getThankYouStatus(
    publicRef: string
): Promise<ThankYouBooking> {
    return apiFetch<ThankYouBooking>(
        `/bookings/typ/${encodeURIComponent(publicRef)}`
    );
}
