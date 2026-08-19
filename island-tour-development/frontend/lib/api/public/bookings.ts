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
import { BackendUnavailableError, publicGetStrict, publicPost } from './fetch';
import { TRAVELER_SESSION_HEADER } from '@/lib/traveler-session.shared';
import {
    INTERNAL_CLIENT_IP_HEADER,
    visitorIp,
} from '@/lib/api/visitor-throttle';

/**
 * Conversion payload (master booking_complete contract; value = EUR commission).
 * NOT part of the TYP GET - it is served once, mark-first, by the dedicated
 * `POST typ/:publicRef/conversion` endpoint (wired in A1/#42) so the browser
 * pixel cannot double-fire across refreshes / the processing poller.
 */
/** SHA-256 hashed PII for Google Enhanced Conversions (master 8.3), hashed
 *  server-side; raw PII never reaches the browser. */
export interface ConversionUserData {
    sha256_email_address?: string;
    sha256_phone_number?: string;
    sha256_first_name?: string;
    sha256_last_name?: string;
    address?: {
        sha256_city?: string;
        sha256_postal_code?: string;
        sha256_country?: string;
    };
}

/** Click ids captured at landing (master 8.3 `click_ids`). Single source of
 *  truth for the key set (type + iteration) is `lib/tracking/click-ids.ts`. */
import type { ConversionClickIds } from '@/lib/tracking/click-ids';
export type { ConversionClickIds };

/**
 * Why the backend withheld a conversion payload, when the reason is a CORRUPT
 * booking rather than the ordinary "already claimed / unverified / not yet
 * confirmed". Mirrors the backend `ConversionDataError` enum.
 *
 * `conversion: null` is the healthy majority case (every refresh returns it), so
 * the TYP can never treat a bare null as a fault. This is the one case that is.
 */
export type ConversionDataError = 'NULL_COMMISSION';

/** Result of the one-time conversion claim: the payload, or the reason it is
 *  missing when that reason is a data fault worth rendering (rule #22). */
export interface ConversionClaim {
    conversion: TypConversion | null;
    dataError: ConversionDataError | null;
}

export interface TypConversion {
    event: string;
    eventId: string;
    /** Human booking reference (display ref) - the master 8.3 booking_ref. */
    bookingRef: string;
    currency: string;
    value: string;
    contentId: string;
    contentName: string | null;
    /** Denormalized destination slug (master 8.3 island). */
    island: string;
    /** GA4 item_brand / segmentation (master 8.3). */
    operatorId: string;
    operatorName: string | null;
    /** Primary category name (GA4 item_category); null when uncategorized. */
    itemCategory: string | null;
    /** GA4 user_id: SHA-256 of the lowercased email - never raw PII. */
    userId: string | null;
    /** Click ids captured at landing; null when the booking is organic. */
    clickIds: ConversionClickIds | null;
    /** Hashed PII (Enhanced Conversions); null when there is no email to hash. */
    userData: ConversionUserData | null;
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

/** One purchased extra (immutable BookingAddOn snapshot), booking currency. */
export interface TypAddOnLine {
    name: string;
    unit: 'PER_PERSON' | 'FLAT';
    quantity: number;
    unitPrice: string;
    totalPrice: string;
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
    /**
     * FE-12 review affordance. **Null on an unverified payload** - the token is
     * a WRITE credential (anyone holding it can submit a review as this guest),
     * so it never rides on a payload a shared `publicRef` link can fetch.
     *
     * Gate the CTA on `canReview`, never on status alone: it is the SAME
     * predicate the create endpoint enforces, so a button driven by anything
     * else will offer a review the API then refuses.
     */
    review: {
        reviewed: boolean;
        canReview: boolean;
        reviewToken: string | null;
    } | null;
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
    /** Purchased extras (empty when none were bought). */
    addOns: TypAddOnLine[];
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
}

/**
 * Fixed backoff (ms) for the TYP re-read below, one entry per retry attempt.
 * No jitter and no clock reads - the same constraint the sibling fetch layer
 * documents - even though this particular path is always uncached.
 */
const TYP_RETRY_BACKOFF_MS = [250, 600];

const sleep = (ms: number) =>
    new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * Fetch the real TYP payload by public ref, or null on a backend 404.
 * `sessionToken` (the HttpOnly traveler cookie, read server-side) unlocks the
 * unmasked payload; without it the backend returns masked mode. Uncached, so
 * the per-user header is safe here.
 *
 * RETRIED, unlike every other `publicGetStrict` caller. This read runs moments
 * after the settle call that confirmed the booking - the same request in which
 * the backend synchronously retrieves the PaymentIntent and sends BOTH
 * confirmation emails inline - so it lands in the narrow window where the API
 * is most likely to be briefly slow or unavailable. `publicFetch` already
 * retries 429/503; it does NOT retry a network error or a 5xx, and those are
 * exactly what surfaces here as `BackendUnavailableError` -> the generic error
 * screen, shown to someone who has just been charged.
 *
 * The retry is safe because this is an idempotent GET, and correct because we
 * KNOW the booking exists: a genuine 404 comes back as `null` from the first
 * call and returns immediately without burning an attempt. Only "could not ask
 * the backend" is retried, and the strict throw still stands once the attempts
 * are exhausted - a traveller with a real booking is never told it is missing.
 *
 * It deliberately does NOT retry 429/503: `publicFetch` already exhausts its own
 * two attempts on those, so retrying here would MULTIPLY (3 x 3 = 9 calls from a
 * single page load). Every SSR render shares one egress IP against the backend's
 * per-IP throttle, so during a burst that stacking is what turns a brief 429
 * into a self-sustaining one. This layer covers only the classes `publicFetch`
 * does not: a network error and a 5xx. Worst case stays 3 calls either way.
 */
export async function getTypByRef(
    publicRef: string,
    sessionToken?: string | null
): Promise<TypResponse | null> {
    const path = `/bookings/typ/${encodeURIComponent(publicRef)}`;
    const headers = sessionToken
        ? { [TRAVELER_SESSION_HEADER]: sessionToken }
        : undefined;

    let lastError: unknown;
    for (let attempt = 0; attempt <= TYP_RETRY_BACKOFF_MS.length; attempt++) {
        try {
            return await publicGetStrict<TypResponse>(path, headers);
        } catch (err) {
            lastError = err;
            // Already retried downstream - do not stack another round on top.
            if (
                err instanceof BackendUnavailableError &&
                (err.status === 429 || err.status === 503)
            ) {
                throw err;
            }
            if (attempt < TYP_RETRY_BACKOFF_MS.length) {
                await sleep(TYP_RETRY_BACKOFF_MS[attempt]);
            }
        }
    }
    throw lastError;
}

/**
 * Claim the one-time `booking_complete` push for a booking (master 8.2).
 *
 * Server-side only: forwards the HttpOnly traveler session so the backend can
 * verify ownership (the value is the commission take-rate, never exposed to a
 * bare link). The backend serves the payload to the mark-first WINNER and null to
 * every later caller, so calling this on each TYP render is safe - only the first
 * ever call returns a payload. Never throws (`publicPost` swallows to null): a
 * failed or lost claim simply yields no push, an accepted false negative that can
 * never blank the TYP or double-fire the pixel.
 *
 * It forwards the VISITOR's IP as well. This route declares its own tight
 * `@Throttle()` (3/10s, 5/min, 20/hr), which excludes it from the internal
 * secret's throttle bypass - correct, but it is also the one route we call
 * server-to-server, so without the forwarded address every traveller on the
 * platform would share a single bucket keyed on this renderer's egress IP and
 * conversion tracking would quietly stop. The backend honours the header only
 * alongside a valid internal secret (`TrustedOriginThrottlerGuard.getTracker`),
 * so it cannot be spoofed from a browser.
 *
 * Reading `headers()` is safe here and ONLY here: this is a mutating,
 * deliberately uncached call made after `connection()`. Never lift it into the
 * shared `serverHeaders()` - that is used inside `'use cache'` scopes, where
 * request headers are unavailable.
 */
export async function claimConversionPush(
    publicRef: string,
    sessionToken?: string | null
): Promise<ConversionClaim> {
    const extraHeaders: Record<string, string> = {};
    if (sessionToken) extraHeaders[TRAVELER_SESSION_HEADER] = sessionToken;

    const clientIp = await visitorIp();
    if (clientIp) extraHeaders[INTERNAL_CLIENT_IP_HEADER] = clientIp;

    const res = await publicPost<{
        conversion: TypConversion | null;
        dataError: ConversionDataError | null;
    }>(
        `/bookings/typ/${encodeURIComponent(publicRef)}/conversion`,
        Object.keys(extraHeaders).length > 0 ? extraHeaders : undefined
    );
    return {
        conversion: res?.conversion ?? null,
        // A transport failure is NOT corruption - an unreachable backend must not
        // put a data-integrity banner in front of a traveller who booked fine.
        dataError: res?.dataError ?? null,
    };
}

