/**
 * Pure mappers from the public tour payload to the shape the booking widget
 * (`TourBookingCard`) consumes. No server/client-only imports - safe to call
 * from the Server Component that renders the card and inside the client widget.
 *
 * The widget is fully interactive (date -> time -> party -> price) but availability
 * (real departures / remaining spots) lands with the booking module, so time slots
 * are derived from the tour's `startTimes` and every slot is selectable for now.
 */
import type { PublicTourAgeBand, PublicTourDetail } from '@/types/tour-detail';
import type { PaymentModel, PricingModel } from '@/types/trip';

/**
 * Content for a policy modal (Figma nodes 48125:20233 / 48125:21537). Every
 * string may carry `{hours}` / `{pct}` placeholders, filled from the tour data.
 */
export type PolicyModalDict = {
    /** Big header title (32px). */
    title: string;
    /** Lead-in heading + paragraph. */
    introTitle: string;
    introBody: string;
    /** Orange "HOW IT WORKS" box: heading + steps. */
    stepsTitle: string;
    steps: string[];
    /** Closing heading + paragraph. */
    outroTitle: string;
    outroBody: string;
};

/** Copy/i18n contract for the booking widget, resolved by the page. */
export type TourBookingDict = {
    from: string;
    perPerson: string;
    continue: string;
    selected: string;
    soldOut: string;
    /** Default per-slot status line ("Available") when not selected/scarce/sold out. */
    available: string;
    /** Calendar hover hint for a day with no departures (no schedule that weekday). */
    calendarNoDepartures: string;
    /** Calendar hover hint for a day whose departures are all closed (e.g. an exception). */
    calendarClosed: string;
    /** "Only {count} left" */
    onlyLeft: string;
    /** "{count} Travelers" */
    travelers: string;
    /** "{count} Guests" - party header for a UNIT (whole-unit / charter) tour. */
    guests: string;
    /** Headline suffix per unit type (in place of "per person"): group/boat/vehicle/aircraft/package. */
    perGroup: string;
    perBoat: string;
    perVehicle: string;
    perAircraft: string;
    perPackage: string;
    /** UNIT headline sub-line: base coverage, e.g. "Up to {count} guests". */
    unitIncludes: string;
    /** UNIT headline sub-line: surcharge, e.g. "+{price} per extra guest". */
    unitExtra: string;
    /** UNIT price-breakdown base row, e.g. "Charter (up to {count} guests)". */
    unitCharterLine: string;
    /** UNIT price-breakdown surcharge row label ("Extra guests"). */
    unitExtraGuests: string;
    /** PRIVATE unit badge, e.g. "Private charter - you get the whole {unit}". */
    privateCharter: string;
    total: string;
    payToday: string;
    balanceLater: string;
    /** Balance-row label for the `on_arrival` model ("Balance on arrival"). */
    balanceOnArrival: string;
    taxesIncluded: string;
    showDetails: string;
    /** Trust line with a `{link}` marker for the clickable part, e.g. "{link} up to {hours}h". */
    freeCancellation: string;
    /** Clickable/underlined phrase inside `freeCancellation` (opens the modal). */
    freeCancellationLink: string;
    /** Deposit trust line (`operator_link`): `{link}` marker, "the rest via the operator's secure link". */
    payLater: string;
    /** Deposit trust line (`on_arrival`): `{link}` marker, "the rest on arrival". */
    payOnArrival: string;
    /** Full-payment trust line (`paid_in_full`): plain statement, no modal link. */
    payInFull: string;
    /** Clickable/underlined phrase inside the deposit trust line (opens the modal). */
    payLaterLink: string;
    sellOutTitle: string;
    sellOutSubtitle: string;
    // Booking Widget V2
    selectDate: string;
    checkAvailability: string;
    /** Shown in place of the CTA when the tour's payment model is not bookable in v1. */
    bookingUnavailable: string;
    apply: string;
    /** "/per person" */
    perPersonShort: string;
    /** Price label for a free age band (infants). */
    free: string;
    bringingSpectators: string;
    spectatorNote: string;
    yes: string;
    no: string;
    /** Line-item label for spectator rows. */
    spectators: string;
    /** "Only {count} spots left for this departure" (party at/over slot capacity). */
    capacityNote: string;
    /** "Up to {count} travellers per booking" (party at the tour's per-booking max,
     *  not scarcity - keeps capacity messaging honest per master ethical CRO). */
    maxPerBooking: string;
    /** Aria-label for the policy-modal close button. */
    policyClose: string;
    /** Free-cancellation policy modal (opened from the trust line). */
    cancellationModal: PolicyModalDict;
    /** Deposit / pay-later policy modal (opened from the trust line). */
    depositModal: PolicyModalDict;
};

/** A single priced row in the party selector (participant age band or spectator). */
export interface BookingBand {
    id: string;
    /** PARTICIPANT rows join the activity; SPECTATOR rows come along but don't. */
    kind: 'participant' | 'spectator';
    /** Localized label, e.g. "Adult (age 13+)". */
    label: string;
    /** Per-person price in the tour's default currency (0 = free, e.g. infants). */
    price: number;
    /** The band pre-selected with a starting count (the tour's default age band). */
    isDefault: boolean;
}

/** A selectable departure time with its (future) availability state. */
export interface BookingSlot {
    /** Wall-clock start time ("HH:MM"). */
    time: string;
    /** `sold_out` slots render disabled; everything else is selectable. */
    status: 'available' | 'sold_out';
    /** Low-capacity hint ("Only N left") for DISPLAY; withheld (null) above the
     *  anti-scarcity threshold (master §4). Do not use this to cap the party. */
    remaining: number | null;
    /** True seats left (capacity - booked), used to CAP the party even when
     *  `remaining` is withheld. Optional (absent in the design/demo dataset). */
    seatsLeft?: number | null;
}

/** Everything the booking widget needs, resolved from a single tour fetch. */
export interface TourBookingData {
    /** Currency glyph for the tour's default currency ("$" / "€"). */
    currencySymbol: string;
    /** Headline "From" price (per person for PER_PERSON, group base for UNIT). */
    priceFrom: number;
    /**
     * Pricing model. `PER_PERSON` sums the age-band steppers; `UNIT` (whole-unit
     * / charter) charges `basePrice` for up to `unitIncludedGuests`, then
     * `extraPersonPrice` per extra guest (§3.2).
     */
    pricingModel: PricingModel;
    /** UNIT: whole-unit base price (covers up to `unitIncludedGuests`). */
    basePrice: number;
    /** UNIT: guests covered by `basePrice` before the per-head surcharge (null for PER_PERSON). */
    unitIncludedGuests: number | null;
    /** UNIT: surcharge per guest beyond `unitIncludedGuests` (0 for PER_PERSON). */
    extraPersonPrice: number;
    /** UNIT: the unit kind (BOAT / VEHICLE / ...), for labelling. */
    wholeUnitType: string | null;
    /** Booking exclusivity (PRIVATE / SHARED); PRIVATE + UNIT gets the whole unit. */
    bookingType: string | null;
    /** Priced party rows in display order (participants first, then spectators). */
    bands: BookingBand[];
    /** Departure-time slots offered by the tour. */
    slots: BookingSlot[];
    /** Payment model - drives the CTA label, money rows, and trust lines (§3.1). */
    paymentModel: PaymentModel;
    /** Free-cancellation window in hours (enum-bound, NOT NULL). */
    cancellationHours: number;
    /** Deposit percentage taken today (0-100). */
    depositPct: number;
    /** True when only a deposit is due today (0 < pct < 100 and the model splits payment). */
    requiresDeposit: boolean;
    /** Smallest bookable party (participants). */
    minPartySize: number;
    /** Largest bookable party, or null for no cap. */
    maxPartySize: number | null;
}

/**
 * Dummy dataset for design work: a Pattern B (age-banded) tour with spectators
 * and mixed slot availability, so a single card exercises every screen -
 * calendar, slot states (available / "Only N left" / sold out), traveler
 * steppers, the spectators field, and the price summary + line-item breakdown.
 * Used as the `TourBookingCard` fallback when no live `data` is passed.
 */
export const DUMMY_BOOKING_DATA: TourBookingData = {
    currencySymbol: '$',
    priceFrom: 120,
    pricingModel: 'PER_PERSON',
    basePrice: 120,
    unitIncludedGuests: null,
    extraPersonPrice: 0,
    wholeUnitType: null,
    bookingType: null,
    bands: [
        { id: 'adult', kind: 'participant', label: 'Adult (age 13+)', price: 120, isDefault: true },
        { id: 'child', kind: 'participant', label: 'Child (age 4-12)', price: 65, isDefault: false },
        { id: 'infant', kind: 'participant', label: 'Infant (age 0-3)', price: 0, isDefault: false },
        { id: 'spec-adult', kind: 'spectator', label: 'Adult (age 13+)', price: 20, isDefault: false },
        { id: 'spec-kid', kind: 'spectator', label: 'Kid (age 4-12)', price: 10, isDefault: false },
    ],
    slots: [
        { time: '08:00', status: 'available', remaining: 20 },
        { time: '13:00', status: 'available', remaining: 2 },
        { time: '16:00', status: 'sold_out', remaining: 0 },
    ],
    paymentModel: 'OPERATOR_LINK',
    cancellationHours: 48,
    depositPct: 20,
    requiresDeposit: true,
    minPartySize: 1,
    maxPartySize: 20,
};

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€' };

/** Currency glyph for a currency code, defaulting to "$". */
export function currencySymbol(code: string | null | undefined): string {
    return (code && CURRENCY_SYMBOLS[code]) || '$';
}

function toNumber(value: string | number | null | undefined): number {
    const n = Number(value ?? 0);
    return Number.isFinite(n) ? n : 0;
}

function mapBand(band: PublicTourAgeBand): BookingBand {
    return {
        id: band.id,
        kind: band.participation === 'SPECTATOR' ? 'spectator' : 'participant',
        label: band.label,
        price: toNumber(band.price),
        isDefault: band.isDefault,
    };
}

/**
 * Build the widget's data model from a tour detail payload.
 *
 * PER_PERSON tours drive the party selector from age bands (participants +
 * optional spectators); a tour with no bands gets a single synthetic "Adult"
 * band at its `priceFrom`. UNIT (whole-unit / charter) tours ignore the age
 * bands entirely and expose a single "guests" stepper - the total is computed
 * from `basePrice` + surcharge in `deriveBooking`, not by summing bands, so the
 * synthetic guests band is priced 0 (Pattern A - inline stepper).
 */
export function buildTourBookingData(detail: PublicTourDetail): TourBookingData {
    const symbol = currencySymbol(detail.defaultCurrency);
    const pricingModel = detail.pricingModel;
    const isUnit = pricingModel === 'UNIT';
    // The included-guests + extra-person surcharge applies ONLY to GROUP unit
    // pricing; boat/vehicle/aircraft/package charters are a flat whole-unit price.
    // Guarding here keeps the card correct even against stale data.
    const isGroupUnit = isUnit && detail.wholeUnitType === 'GROUP';
    const basePrice = Math.round(toNumber(detail.basePrice ?? detail.priceFrom));
    const extraPersonPrice = isGroupUnit
        ? Math.round(toNumber(detail.extraPersonPrice))
        : 0;
    // Headline: group base for UNIT, per-person "from" for PER_PERSON.
    const priceFrom = isUnit
        ? basePrice
        : Math.round(toNumber(detail.priceFrom ?? detail.basePrice));

    const ordered = [...detail.ageBands].sort(
        (a, b) => a.displayOrder - b.displayOrder
    );
    const participants = ordered.filter(b => b.participation !== 'SPECTATOR');
    const spectators = ordered.filter(b => b.participation === 'SPECTATOR');

    let bands: BookingBand[];
    if (isUnit) {
        // Whole-unit charter: a single guests counter, priced 0 here (the UNIT
        // total is derived from basePrice + per-guest surcharge downstream).
        bands = [
            {
                id: 'unit-guests',
                kind: 'participant',
                label: 'Guests',
                price: 0,
                isDefault: true,
            },
        ];
    } else if (participants.length === 0) {
        // No age bands configured: one participant row at the headline price.
        bands = [
            {
                id: 'default-adult',
                kind: 'participant',
                label: 'Adult',
                price: priceFrom,
                isDefault: true,
            },
            ...spectators.map(mapBand),
        ];
    } else {
        bands = [...participants, ...spectators].map(mapBand);
    }

    const depositPct = Math.round(toNumber(detail.depositPct));
    const model = detail.paymentModel;
    const splitsPayment = model === 'OPERATOR_LINK' || model === 'ON_ARRIVAL';
    const requiresDeposit = splitsPayment && depositPct > 0 && depositPct < 100;

    // Availability (remaining spots / sold-out) lands with the booking module;
    // for now every offered start time is selectable with no capacity hint.
    const slots: BookingSlot[] = detail.startTimes.map(time => ({
        time,
        status: 'available',
        remaining: null,
    }));

    return {
        currencySymbol: symbol,
        priceFrom,
        pricingModel,
        basePrice,
        unitIncludedGuests: isGroupUnit ? detail.unitIncludedGuests : null,
        extraPersonPrice,
        wholeUnitType: detail.wholeUnitType,
        bookingType: detail.bookingType,
        bands,
        slots,
        paymentModel: model,
        cancellationHours: detail.cancellationHours,
        depositPct,
        requiresDeposit,
        minPartySize: detail.minPartySize,
        maxPartySize: detail.maxPartySize,
    };
}
