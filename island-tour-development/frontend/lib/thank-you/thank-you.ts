/**
 * Thank-you page (TYP) data layer. Wraps the public TYP lookup
 * (BOOKING-FLOW-DESIGN-GUIDE.md §12: `GET /api/v1/bookings/typ/:publicRef`,
 * keyed by the unguessable `publicRef`; `displayRef` is customer-facing).
 *
 * The backend returns RAW booking values; every human label below is composed
 * here so it stays locale-correct. The lookup is UNCACHED (per-traveller data);
 * callers await it inside a `<Suspense>` boundary after `connection()`.
 */
import { getTypByRef, type TypResponse } from '@/lib/api/public/bookings';
import { getDestinationBySlug } from '@/lib/api/public/destinations';
import { getDestinationTours } from '@/lib/api/public/tours';
import { bookingIcsUrl } from '@/lib/booking-ics';
import type { Currency, Locale } from '@/lib/constants/locales';
import { currencySymbol } from '@/lib/tours/booking';
import type { SearchHit } from '@/types/search';

/**
 * Prerender token for the TYP shell. Real refs are UUIDs resolved at request
 * time; this only exists so `generateStaticParams` has >=1 entry (every
 * (frontend) route needs one or the layout throws a Blocking Route error).
 */
export const DEMO_PUBLIC_REF = 'pr-demo-2026-04821';

/** Island Tours support inbox shown in the TYP "questions" block. */
const SUPPORT_EMAIL = 'reservations@island.tours';

export interface ThankYouPayment {
    currencySymbol: string;
    /**
     * The booking's own currency code. Carried alongside the symbol so the TYP
     * and cancel pages can run amounts through `formatMoney` (grouping +
     * fixed decimals) instead of concatenating `symbol + number`, which
     * rendered a 1750.00 total as "$1750".
     */
    currency: Currency;
    total: number;
    /** Deposit already collected by Island Tours; 0 = nothing paid online. */
    depositPaid: number;
    depositPct: number;
    /** Operator-collected remainder; 0 = paid in full. */
    balance: number;
    balancePct: number;
    /** e.g. "Mastercard *****4242" - how the deposit was paid. */
    cardLabel: string;
    /** Local date the operator balance is due ("Sat 25 May, 2026"). */
    payBeforeLabel: string;
    /** Short variant for the next-steps strip ("tue, 19 May"). */
    payBeforeShort: string;
}

export interface ThankYouBooking {
    /**
     * True when the request carried the traveler session cookie for this
     * booking (fresh booker from checkout, or the /bookings pair login).
     * False = the bare-link masked view: identity fields arrive pre-masked
     * from the backend and the page swaps its manage actions for a
     * "verify it's you" card.
     */
    verified: boolean;
    publicRef: string;
    /**
     * Null on the masked view. The reference identifies the traveller to
     * support, so a forwarded link does not carry it - see the backend note in
     * `getThankYou`. Every surface that prints it must handle the absence.
     */
    displayRef: string | null;
    /** Real booking status; the TYP is normally reached only once CONFIRMED. */
    status: string;
    /**
     * Server-decided cancellation state. `canCancel` is the same predicate the
     * submit endpoint enforces - gate every cancel affordance on it, never on
     * `status` alone, or the page offers a request the API will refuse.
     */
    canCancel: boolean;
    /**
     * FE-12. Server-decided, and gated behind a VERIFIED payload - the token is
     * a write credential, so a shared `publicRef` link never carries one.
     * `canReview` is the same predicate the create endpoint enforces.
     */
    canReview: boolean;
    reviewed: boolean;
    reviewToken: string | null;
    /** Set once the traveller has asked; the page shows a pending notice. */
    cancellationRequestedAt: string | null;
    /** Set once an admin has actually processed it. */
    cancelledAt: string | null;
    /** Booked tour - used to exclude it from the cross-sell grid. */
    tourId: string;
    guestFirstName: string;
    guestLead: string;
    /**
     * The booker's own confirmation address, ALWAYS masked for display
     * (`d•••@g•••.com`) - it appears only in the "confirmation email sent to X"
     * reassurance line, and booking screens get screenshotted/shared, so the
     * full address is never rendered. Empty on the unverified payload.
     */
    guestEmail: string;
    tourTitle: string;
    destinationSlug: string;
    dateLabel: string;
    startTimeLabel: string;
    timeRangeLabel: string;
    durationLabel: string;
    pickupLabel: string;
    /**
     * Raw meeting-point address for a maps link, or null when there is no
     * concrete address yet (unverified, no pickup, or "to be confirmed"). The
     * summary renders `pickupLabel` as a map link only when this is present.
     */
    pickupMapQuery: string | null;
    freeCancelBeforeLabel: string;
    /** Real UTC deadline instant - the /cancel page's in-window check. */
    freeCancelDeadlineUtc: string | null;
    /** Tour's free-cancellation window; the after-window locked copy needs it. */
    cancellationHours: number;
    partyLabel: string;
    /** Purchased extras, one line each ("2 x Open bar upgrade"); empty = row hidden. */
    extras: string[];
    operatorName: string;
    /** Casual short name used in payment copy ("Miss ann will email you..."). */
    operatorShortName: string;
    operatorEmail: string;
    operatorPhone: string;
    supportEmail: string;
    payment: ThankYouPayment;
    /**
     * True once the tour has finished.
     *
     * Decided HERE rather than in the component, for the same reason `canCancel`
     * is: a render that reads the clock is impure (the React compiler rejects
     * it) and would also drift between the server pass and hydration. Drives
     * whether "add to calendar" is offered at all - the event is in the past.
     */
    departed: boolean;
    /** ISO start/end used for the add-to-calendar link. */
    startsAtIso: string;
    endsAtIso: string;
}

/**
 * The post-booking cross-sell used to be a hardcoded `APARTMENT_PROMO` constant
 * here, on the booking payload. It is NOT booking data - it is the same card for
 * every traveller - so it now comes from `getRecommendation()` (Dashboard >
 * Recommendations), which is cached under its own tag instead of being re-derived
 * inside every per-traveller lookup. Do not add it back to this interface.
 */

// ── Label formatting ────────────────────────────────────────────────────────
// The backend sends destination-LOCAL wall-clock parts plus real UTC instants.
// Everything below renders the LOCAL parts, so a Curaçao 8am tour reads "8:00 AM"
// no matter where the server or the traveller is.

/** Compose a Date from local wall-clock parts. Never treat the result as UTC. */
function localDateTime(localDate: string, time: string | null): Date | null {
    if (!time) return null;
    const d = new Date(`${localDate}T${time.slice(0, 5)}:00`);
    return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Figma renders English DATES day-then-month ("Tue 28 May, 2026") - that is en-GB
 * order, not en-US ("Fri, Jul 24, 2026"). Every other supported locale already
 * formats day-first, so only `en` is remapped. TIMES deliberately keep the plain
 * locale: Figma shows 12-hour "8:00 AM", and en-GB would force 24-hour "13:30".
 */
const DATE_LOCALE: Partial<Record<Locale, string>> = { en: 'en-GB' };

function dateLocale(locale: Locale): string {
    return DATE_LOCALE[locale] ?? locale;
}

function fmtDate(d: Date, locale: Locale): string {
    return new Intl.DateTimeFormat(dateLocale(locale), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(d);
}

function fmtDayMonth(d: Date, locale: Locale): string {
    return new Intl.DateTimeFormat(dateLocale(locale), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    }).format(d);
}

function fmtShortDayMonth(d: Date, locale: Locale): string {
    return new Intl.DateTimeFormat(dateLocale(locale), {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(d);
}

function fmtTime(d: Date, locale: Locale): string {
    return new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
    }).format(d);
}

/** "9h" / "1h 30m" - matches the duration format used on tour cards. */
function fmtDuration(minutes: number | null): string {
    if (!minutes || minutes <= 0) return '';
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h && m) return `${h}h ${m}m`;
    return h ? `${h}h` : `${m}m`;
}

/** Irregular plurals for the common age-band labels ("1 child" -> "2 children"). */
const IRREGULAR_PLURALS: Record<string, string> = {
    child: 'children',
    person: 'people',
    adult: 'adults',
};

/**
 * "2 adults, 1 child" from the grouped party lines.
 *
 * The backend sends the SINGULAR unit ('Adult', 'Guest') and this pluralises it.
 * Labels are operator-authored free text though, so it stays conservative:
 * - a label already ending in 's' is left alone (an operator band named "Adults"
 *   would otherwise render "2 adultss")
 * - anything that is not a single bare word ("Child (4-12)") is left verbatim
 *   rather than mangled
 */
function fmtParty(party: TypResponse['party']): string {
    return party
        .map(line => {
            const base = line.label.toLowerCase();
            const plural =
                line.quantity > 1 ? (IRREGULAR_PLURALS[base] ?? pluralise(base)) : base;
            return `${line.quantity} ${plural}`;
        })
        .join(', ');
}

/** Append 's' only when it is safe to: a single bare word not already plural. */
function pluralise(base: string): string {
    if (!/^[a-z]+$/.test(base) || base.endsWith('s')) return base;
    return `${base}s`;
}

/**
 * Mask an email for display: `devripon.io@gmail.com` -> `d•••@g•••.com` (first
 * local char + first domain char + TLD only). Mirrors the backend `maskEmail`
 * (traveler-session.util.ts) so masked mode and the confirmation line match.
 */
function maskEmail(email: string | null | undefined): string {
    if (!email) return '';
    const at = email.lastIndexOf('@');
    if (at < 1) return '•••';
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    const dot = domain.lastIndexOf('.');
    const tld = dot > 0 ? domain.slice(dot) : '';
    return `${local.slice(0, 1)}•••@${domain.slice(0, 1)}•••${tld}`;
}

/** "Mastercard *****4242"; empty when nothing was charged online. */
function fmtCard(brand: string | null, last4: string | null): string {
    if (!brand && !last4) return '';
    const name = brand
        ? brand.charAt(0).toUpperCase() + brand.slice(1)
        : 'Card';
    return last4 ? `${name} *****${last4}` : name;
}

/** Percentage of the total, rounded; 0 when the total is 0. */
function pctOf(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
}

/**
 * Public TYP lookup by `publicRef`. Uncached by design (per-traveller booking
 * data); callers await it inside a `<Suspense>` boundary after `connection()`.
 * Returns null when the ref cannot be resolved, so the page can `notFound()`.
 */
export async function getThankYouBooking(
    publicRef: string,
    locale: Locale = 'en',
    sessionToken?: string | null,
): Promise<ThankYouBooking | null> {
    const typ = await getTypByRef(publicRef, sessionToken);
    if (!typ) return null;

    const start = localDateTime(typ.localDate, typ.startTime);
    const end = localDateTime(typ.localDate, typ.endTime);
    const deadline = typ.freeCancellationDeadlineLocal
        ? new Date(typ.freeCancellationDeadlineLocal)
        : null;

    const total = Number(typ.totalRetail);
    const depositPaid = Number(typ.depositAmount);
    const balance = Number(typ.balanceAmount);
    const depositPct = pctOf(depositPaid, total);

    const startLabel = start ? fmtTime(start, locale) : '';
    const endLabel = end ? fmtTime(end, locale) : '';

    const operatorName = typ.operator.name ?? '';

    return {
        verified: typ.verified,
        publicRef: typ.publicRef,
        displayRef: typ.displayRef,
        status: typ.status,
        canCancel: typ.canRequestCancellation,
        canReview: typ.review?.canReview ?? false,
        reviewed: typ.review?.reviewed ?? false,
        reviewToken: typ.review?.reviewToken ?? null,
        cancellationRequestedAt: typ.cancellationRequestedAt,
        cancelledAt: typ.cancelledAt,
        tourId: typ.tourId,
        guestFirstName: typ.guestFirstName ?? '',
        guestLead: typ.guestFullName ?? typ.guestFirstName ?? '',
        // Always masked for display - the raw address never reaches the client.
        guestEmail: maskEmail(typ.contactEmail),
        tourTitle: typ.tourName,
        destinationSlug: typ.island ?? '',
        dateLabel: start ? fmtDate(start, locale) : typ.localDate,
        startTimeLabel: startLabel,
        timeRangeLabel:
            startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel,
        durationLabel: fmtDuration(typ.durationMinutes),
        // Snapshot of the chosen pickup point; "other location" reserves carry no
        // address yet (the operator confirms it), hence the requested fallback.
        // Unverified: the backend withholds the address, so this stays empty and
        // the summary hides the row (non-identifying facts only on a shared link).
        pickupLabel:
            typ.pickupAddress ??
            (typ.verified && typ.pickupRequested ? 'To be confirmed' : ''),
        // Only a concrete snapshotted address is map-linkable; "to be confirmed"
        // and the withheld/empty cases carry no query.
        pickupMapQuery: typ.pickupAddress ?? null,
        freeCancelBeforeLabel: deadline ? fmtDayMonth(deadline, locale) : '',
        freeCancelDeadlineUtc: typ.freeCancellationDeadlineUtc,
        cancellationHours: typ.cancellationHours,
        partyLabel: fmtParty(typ.party),
        // Snapshot names as booked; quantity shown like the party ("2 x ...").
        extras: (typ.addOns ?? []).map(a => `${a.quantity} x ${a.name}`),
        operatorName,
        // Casual short form used in the payment copy ("Miss Ann will email you...").
        operatorShortName: operatorName.split(' ').slice(0, 2).join(' '),
        operatorEmail: typ.operator.email ?? '',
        operatorPhone: typ.operator.phone ?? '',
        supportEmail: SUPPORT_EMAIL,
        payment: {
            currencySymbol: currencySymbol(typ.currency),
            // The TYP DTO types this as a bare string; the backend only ever
            // snapshots a real currency code onto the booking (guide §20.10).
            currency: typ.currency as Currency,
            total,
            depositPaid,
            depositPct,
            balance,
            balancePct: balance > 0 ? 100 - depositPct : 0,
            cardLabel: fmtCard(typ.paymentMethodBrand, typ.paymentMethodLast4),
            // No balance-due date is modelled (guide §13 leaves the operator's
            // collection timing to them), so the tour date is the honest bound:
            // the balance is due by the time the tour runs.
            payBeforeLabel: start ? fmtDate(start, locale) : '',
            payBeforeShort: start ? fmtShortDayMonth(start, locale) : '',
        },
        departed: end ? end.getTime() <= Date.now() : false,
        // Local wall-clock ISO for the calendar link (floating time, so the event
        // lands at the destination's 8am regardless of the traveller's zone).
        startsAtIso: start ? `${typ.localDate}T${typ.startTime}:00` : '',
        endsAtIso: end ? `${typ.localDate}T${typ.endTime}:00` : '',
    };
}

/**
 * Real cross-sell tours for the TYP ("Islanders also love..."), excluding the
 * tour just booked. Returns raw hits - the page maps them with its dictionary.
 * Empty on any failure; the section self-hides.
 */
export async function getThankYouRelatedTours(params: {
    destinationSlug: string;
    excludeTourId: string;
    locale: Locale;
    currency?: Currency;
}): Promise<SearchHit[]> {
    const { destinationSlug, excludeTourId, locale, currency } = params;
    if (!destinationSlug) return [];

    // Soft context: this section simply hides when the destination can't be
    // resolved, so a backend outage (strict loader throw) must not error the TYP.
    const destination = await getDestinationBySlug(destinationSlug, locale).catch(
        () => null,
    );
    if (!destination) return [];

    const { data } = await getDestinationTours({
        destinationId: destination.id,
        locale,
        currency,
        limit: 4,
    });
    return data.filter(hit => hit.id !== excludeTourId).slice(0, 3);
}

/**
 * Google Calendar "add event" URL for the booked departure - one target of the
 * hero's add-to-calendar menu (design v2 .calpanel).
 */
export function buildCalendarUrl(booking: ThankYouBooking): string {
    const compact = (iso: string) => iso.replace(/[-:]/g, '');
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: booking.tourTitle,
        dates: `${compact(booking.startsAtIso)}/${compact(booking.endsAtIso)}`,
        // Only the owner's payload carries a reference; on the masked view the
        // event still saves, just without it.
        details: booking.displayRef ? `Booking ref: ${booking.displayRef}` : '',
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Outlook-web "add event" deeplink - same event fields as the Google URL. */
export function buildOutlookCalendarUrl(booking: ThankYouBooking): string {
    const params = new URLSearchParams({
        path: '/calendar/action/compose',
        rru: 'addevent',
        subject: booking.tourTitle,
        startdt: booking.startsAtIso,
        enddt: booking.endsAtIso,
        body: booking.displayRef ? `Booking ref: ${booking.displayRef}` : '',
    });
    return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

/**
 * The backend's one-event .ics for this booking (same file the confirmation
 * email links) - the menu's Apple Calendar and "Download .ics" targets.
 */
export function buildIcsUrl(booking: ThankYouBooking): string {
    return bookingIcsUrl(booking.publicRef);
}
