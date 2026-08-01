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
import type { Attribution } from '@/lib/tracking/attribution';
import { apiFetch } from './fetch';
import { TRAVELER_SESSION_HEADER } from '@/lib/traveler-session.shared';

/** One priced row of a quote breakdown (participant, add-on, or priced pickup). */
export interface QuoteLine {
    kind: 'participant' | 'addon' | 'pickup';
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
    /**
     * Always null on the quote: the commission snapshot is platform-internal
     * and this route is public. Never render it.
     */
    commissionRate: string | null;
    commissionAmount: string | null;
    paymentModel: string;
    pax: number;
    lines: QuoteLine[];
}

/** One chosen extra (backend `ReserveAddOnDto`) - shared by quote + reserve. */
export interface BookingAddOnSelection {
    addOnId: string;
    quantity: number;
}

/** Body for `POST /bookings/quote` (backend `QuoteBookingDto`). */
export interface QuoteRequest {
    tourId: string;
    departureId: string;
    /** PER_PERSON: one entry per age band with a count (spectators included). */
    items?: { ageBandId: string; quantity: number }[];
    /** UNIT (whole-unit / charter): total guest headcount instead of `items`. */
    guests?: number;
    /** Chosen optional extras; priced into the quote total. */
    addOns?: BookingAddOnSelection[];
    /** Shopper (booking) currency; defaults to the tour currency server-side. */
    currency?: Currency;
    /** Selected pickup zone; a priced PAID_ADDON zone adds a per-person line. */
    pickupLocationId?: string;
}

/**
 * Fetch a server-authoritative quote for a live widget selection. Throws (via
 * `apiFetch`) on a non-2xx response; the caller keeps its optimistic client
 * estimate on failure. Pass an `AbortSignal` to cancel a superseded request.
 *
 * `retryOnThrottle` because this POST is a pure price computation - it claims
 * no seats and writes no rows, so repeating it is as safe as repeating a GET.
 * Without it a quote caught by the backend's burst tier failed outright while
 * every dashboard GET beside it quietly self-healed (test report 2026-08-01).
 */
export async function quoteBooking(
    req: QuoteRequest,
    signal?: AbortSignal
): Promise<BookingQuote> {
    return apiFetch<BookingQuote>('/bookings/quote', {
        method: 'POST',
        body: JSON.stringify(req),
        retryOnThrottle: true,
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
    /** Chosen optional extras; snapshotted as BookingAddOn rows + priced in. */
    addOns?: BookingAddOnSelection[];
    /** Shopper (booking) currency; defaults to the tour currency server-side. */
    currency?: Currency;
    /** Server quote id (forward-compat; reserve recomputes and is authoritative). */
    quoteId?: string;
    pickupRequested?: boolean;
    pickupLocationId?: string;
    notes?: string;
    newsletterOptIn?: boolean;
    /** Ad click ids + UTM captured on the landing page (master 8.1.6). Written on
     *  first reserve only; the backend ignores it on an idempotent re-reserve. */
    attribution?: Attribution;
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
    /**
     * Present on the contact PATCH response only (the patch that sets the
     * email): 24h traveler session for `storeTravelerSession`, so the fresh
     * booker's TYP renders verified (unmasked).
     */
    sessionToken?: string;
}

/** Response of `POST /payments/bookings/:id/intent` (backend `PaymentIntentResponseDto`). */
export interface PaymentIntentResult {
    /** False only when nothing is due now (OPERATOR_FULL) - skip the card step. */
    paymentRequired: boolean;
    /**
     * Which PSP takes this charge (admin-selected). STRIPE → inline Elements
     * via clientSecret; MOLLIE → hosted redirect via checkoutUrl. Absent on
     * older payloads = STRIPE.
     */
    provider?: 'STRIPE' | 'MOLLIE';
    /**
     * Mollie hosted-checkout URL - send the traveller here. Absent on the
     * Stripe path; also absent when the Mollie payment is already paid
     * (status SUCCEEDED - go straight to processing).
     */
    checkoutUrl?: string;
    /**
     * Mollie Components profile (pfl_..., public - the mollie.js sibling of a
     * publishable key). Only on the MOLLIE setup response (phase 1, no
     * returnUrl); absent = inline card form not configured, hosted page only.
     */
    profileId?: string;
    /** Whether the Mollie account runs on a test API key (mollie.js flag). */
    testmode?: boolean;
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
 * Create (or fetch, idempotently) the up-front payment for a booking. Returns
 * `paymentRequired: false` when nothing is due now; otherwise the shape follows
 * the admin-selected provider:
 * - STRIPE: `clientSecret` + `publishableKey` to drive Stripe.js.
 * - MOLLIE, no `redirects` (phase 1): SETUP only - `profileId`/`testmode` for
 *   the inline Components card form; no payment exists yet.
 * - MOLLIE, with `redirects` (phase 2): CREATES the payment - with `cardToken`
 *   it is a creditcard charge for the inline form (checkoutUrl = the 3DS hop),
 *   without one it is the hosted method-selection page.
 */
export async function createPaymentIntent(
    bookingId: string,
    redirects?: { returnUrl: string; cancelUrl?: string; cardToken?: string }
): Promise<PaymentIntentResult> {
    return apiFetch<PaymentIntentResult>(
        `/payments/bookings/${bookingId}/intent`,
        {
            method: 'POST',
            ...(redirects ? { body: JSON.stringify(redirects) } : {}),
        }
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

export interface SettleResult {
    status: string;
    publicRef: string;
    /**
     * True when the latest charge attempt failed/was canceled/expired at the
     * PSP (verified live, both providers). The processing page sends the
     * traveller back to the checkout to retry instead of polling forever.
     */
    paymentFailed?: boolean;
}

/**
 * Confirm the booking synchronously from the browser's return, instead of
 * waiting for the async Stripe webhook. The backend re-verifies the
 * PaymentIntent with Stripe and is idempotent with the webhook, so this only
 * speeds up the redirect - it never double-charges or double-confirms. Keyed
 * on the unguessable publicRef (same capability the TYP URL rides on).
 */
export async function settleBooking(publicRef: string): Promise<SettleResult> {
    return apiFetch<SettleResult>(
        `/payments/typ/${encodeURIComponent(publicRef)}/settle`,
        { method: 'POST' }
    );
}

/**
 * Resend the confirmation email for a booking (TYP "Resend email").
 *
 * The recipient is not a parameter by design: the backend sends only to the
 * address stored on the booking. Throws on failure (404 unknown ref, 409 not
 * confirmed, 429 throttled, 5xx send failure) so the UI can tell the truth
 * instead of showing a false "sent".
 *
 * MUST stay a browser call. The server-only `publicFetch` sends the internal API
 * secret, which the backend throttler treats as a trusted origin and exempts -
 * routing this through SSR would strip its rate limit.
 */
export async function resendConfirmationEmail(
    publicRef: string
): Promise<{ sent: boolean }> {
    return apiFetch<{ sent: boolean }>(
        `/bookings/typ/${encodeURIComponent(publicRef)}/resend`,
        { method: 'POST' }
    );
}

/**
 * Submit a cancellation REQUEST from the tokenized /cancel/{publicRef} page
 * (master 6.4/C1). It never cancels anything - the admin processes the refund
 * and confirms by email.
 *
 * MUST stay a browser call for the same reason as `resendConfirmationEmail`:
 * the route is hard-throttled per IP, and the server-only `publicFetch` would
 * bypass that limit via the internal API secret.
 */
export async function requestBookingCancellation(
    publicRef: string,
    reason?: string
): Promise<{ requested: boolean }> {
    // Goes through our OWN route handler, which reads the HttpOnly session
    // server-side. The token is never handed to the browser: since the
    // account door (/{locale}/traveller) began issuing HISTORY-scoped
    // sessions, the cookie on this page can be the strongest traveller
    // credential there is - 24h against every booking on the email - so
    // serializing it into a client prop would put it one XSS away from being
    // exfiltrated. The backend still owns ownership and eligibility.
    const res = await fetch('/api/traveller/cancellation-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicRef, reason }),
    });
    if (!res.ok) {
        throw new Error('Could not send the cancellation request');
    }
    return { requested: true };
}
