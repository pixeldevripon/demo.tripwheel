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

export interface ThankYouApartment {
    eyebrowArea: string;
    name: string;
    rating: number;
    reviewCount: number;
    sleeps: number;
    pricePerNight: number;
    descriptionLines: string[];
    image: string;
    airbnbUrl: string;
}

export interface ThankYouBooking {
    publicRef: string;
    displayRef: string;
    /** Real booking status; the TYP is normally reached only once CONFIRMED. */
    status: string;
    /** Booked tour - used to exclude it from the cross-sell grid. */
    tourId: string;
    guestFirstName: string;
    guestLead: string;
    guestEmail: string;
    tourTitle: string;
    destinationSlug: string;
    dateLabel: string;
    startTimeLabel: string;
    timeRangeLabel: string;
    durationLabel: string;
    pickupLabel: string;
    freeCancelBeforeLabel: string;
    partyLabel: string;
    operatorName: string;
    /** Casual short name used in payment copy ("Miss ann will email you..."). */
    operatorShortName: string;
    operatorEmail: string;
    operatorPhone: string;
    supportEmail: string;
    payment: ThankYouPayment;
    /** ISO start/end used for the add-to-calendar link. */
    startsAtIso: string;
    endsAtIso: string;
    /**
     * Conversion value in EUR (critical rule 22: `commission_amount`, never
     * GMV). A CONFIRMED booking with null commission is data corruption - the
     * tracking module must fire NO conversion for it.
     */
    commissionAmountEur: number | null;
    apartment: ThankYouApartment;
}

/**
 * Island Tours' own apartment cross-sell. This is static marketing content, not
 * booking data - it is the same card for every traveller.
 */
const APARTMENT_PROMO: ThankYouApartment = {
    eyebrowArea: 'Jan Thiel',
    name: 'Palm Suite Apartment',
    rating: 4.8,
    reviewCount: 1738,
    sleeps: 4,
    pricePerNight: 160,
    descriptionLines: [
        'Quiet, modern, 5min from the beach',
        'Owned and hosted by Island Tours',
    ],
    image: 'https://picsum.photos/seed/typ-apartment/1176/758',
    airbnbUrl: 'https://www.airbnb.com',
};

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
 * "2 adults, 1 child" from the grouped party lines. Age-band labels are operator
 * text, so only a single bare word is pluralised - anything else (e.g.
 * "Child (4-12)") is left verbatim rather than mangled.
 */
function fmtParty(party: TypResponse['party']): string {
    return party
        .map(line => {
            const base = line.label.toLowerCase();
            const plural =
                line.quantity > 1
                    ? (IRREGULAR_PLURALS[base] ??
                      (/^[a-z]+$/.test(base) ? `${base}s` : base))
                    : base;
            return `${line.quantity} ${plural}`;
        })
        .join(', ');
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
): Promise<ThankYouBooking | null> {
    const typ = await getTypByRef(publicRef);
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
        publicRef: typ.publicRef,
        displayRef: typ.displayRef,
        status: typ.status,
        tourId: typ.tourId,
        guestFirstName: typ.guestFirstName ?? '',
        guestLead: typ.guestFullName ?? typ.guestFirstName ?? '',
        guestEmail: typ.contactEmail ?? '',
        tourTitle: typ.tourName,
        destinationSlug: typ.island ?? '',
        dateLabel: start ? fmtDate(start, locale) : typ.localDate,
        startTimeLabel: startLabel,
        timeRangeLabel:
            startLabel && endLabel ? `${startLabel} - ${endLabel}` : startLabel,
        durationLabel: fmtDuration(typ.durationMinutes),
        // Snapshot of the chosen pickup point; "other location" reserves carry no
        // address yet (the operator confirms it), hence the requested fallback.
        pickupLabel:
            typ.pickupAddress ?? (typ.pickupRequested ? 'To be confirmed' : ''),
        freeCancelBeforeLabel: deadline ? fmtDayMonth(deadline, locale) : '',
        partyLabel: fmtParty(typ.party),
        operatorName,
        // Casual short form used in the payment copy ("Miss Ann will email you...").
        operatorShortName: operatorName.split(' ').slice(0, 2).join(' '),
        operatorEmail: typ.operator.email ?? '',
        operatorPhone: typ.operator.phone ?? '',
        supportEmail: SUPPORT_EMAIL,
        payment: {
            currencySymbol: currencySymbol(typ.currency),
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
        // Local wall-clock ISO for the calendar link (floating time, so the event
        // lands at the destination's 8am regardless of the traveller's zone).
        startsAtIso: start ? `${typ.localDate}T${typ.startTime}:00` : '',
        endsAtIso: end ? `${typ.localDate}T${typ.endTime}:00` : '',
        // Rule #22: EUR commission, never GMV. Null (no conversion) unless the
        // booking is CONFIRMED with a valid commission - the backend gates this.
        commissionAmountEur: typ.conversion ? Number(typ.conversion.value) : null,
        apartment: APARTMENT_PROMO,
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

    const destination = await getDestinationBySlug(destinationSlug, locale);
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
 * Google Calendar "add event" URL for the booked departure - the demo target
 * of the hero CTA until a proper multi-provider menu is designed.
 */
export function buildCalendarUrl(booking: ThankYouBooking): string {
    const compact = (iso: string) => iso.replace(/[-:]/g, '');
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: booking.tourTitle,
        dates: `${compact(booking.startsAtIso)}/${compact(booking.endsAtIso)}`,
        details: `Booking ref: ${booking.displayRef}`,
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
