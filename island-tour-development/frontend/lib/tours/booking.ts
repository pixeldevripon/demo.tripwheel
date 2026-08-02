/**
 * Pure mappers from the public tour payload to the shape the booking widget
 * (`TourBookingCard`) consumes. No server/client-only imports - safe to call
 * from the Server Component that renders the card and inside the client widget.
 *
 * The widget is fully interactive (date -> time -> party -> price) but availability
 * (real departures / remaining spots) lands with the booking module, so time slots
 * are derived from the tour's `startTimes` and every slot is selectable for now.
 */
import { isCurrency, type Currency } from '@/lib/constants/locales';
import type { PublicTourAgeBand, PublicTourDetail } from '@/types/tour-detail';
import type {
    AddOnUnit,
    PaymentModel,
    PickupModel,
    PricingModel,
} from '@/types/trip';

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
    /** All-sold-out dead end (AVAILABILITY-AND-DEPARTURES.md §8) - LOCKED headline.
     *  The spec fixes this wording: it is a promise about the rows beneath it. */
    deadEndTitle: string;
    /** Sub-line explaining why the calendar is gone. */
    deadEndSubtitle: string;
    /** Per-row next-departure line, e.g. "Next: {date}". */
    deadEndNext: string;
    /** Shown when the destination has nothing bookable this week either. */
    deadEndNoAlternatives: string;
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
    /** "Most popular" notice - earned by reviews (master §3.6). */
    mostPopularTitle: string;
    mostPopularSubtitle: string;
    /** Paid-placement disclosure. Master calls transparency a brand pillar, so
     *  this is a statement of fact, never a selling point. */
    sponsoredTitle: string;
    sponsoredSubtitle: string;
    // Booking Widget V2
    selectDate: string;
    checkAvailability: string;
    /** Inline CTA note when Check Availability is clicked with no date picked. */
    errorSelectDate: string;
    /** Inline CTA note when a date is picked but no departure time is. */
    errorSelectSlot: string;
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
    /** Add-ons consent toggle ("Show extras") - collapsed by default. */
    showExtras: string;
    /** Add-ons section heading ("Optional extras") - widget S4 (master E.3). */
    addOnsTitle: string;
    /** Price suffix for a FLAT add-on ("/per booking"); PER_PERSON reuses perPersonShort. */
    perBookingShort: string;
    /** "Instant confirmation" notice (master 6.1; NOT in the trust strip per LD5). */
    instantConfirmationTitle: string;
    instantConfirmationSubtitle: string;
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

/** An optional extra purchasable in the widget (master E.3 add_ons, never pre-checked). */
export interface BookingAddOn {
    id: string;
    name: string;
    description: string | null;
    /** Unit price in the DISPLAY currency (already converted, cents-exact). */
    price: number;
    /** PER_PERSON multiplies by the party headcount; FLAT charges once per qty. */
    unit: AddOnUnit;
    maxQuantity: number;
}

/** A pickup zone offered at checkout (master 5.8 "operator zones with prices"). */
export interface BookingPickupOption {
    id: string;
    /** Localized zone label (translation title, falling back to the name). */
    label: string;
    /** Per-person price in the DISPLAY currency; null = free (INCLUDED or free zone). */
    price: number | null;
}

/** A selectable departure time with its (future) availability state. */
export interface BookingSlot {
    /** Real departure id (live mode) - required to quote/reserve this slot. Null
     *  in design/demo mode, where slots come from the tour's static start times. */
    departureId?: string | null;
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
/**
 * Notices stacked beneath the booking card. A subset of the master §3.6 badge
 * set - `new` is deliberately excluded: on a listing card it REPLACES the rating
 * row, but the detail page already shows the real rating and review list, so all
 * "New" would add next to a Check Availability button is "nobody has reviewed
 * this yet".
 */
export type BookingNoticeKind =
    | 'likelyToSellOut'
    | 'mostPopular'
    | 'instantConfirmation'
    | 'sponsored';

/** Master §3.6: `mostPopular` is earned at >=10 reviews AND >=4.5 rating. */
const MOST_POPULAR_MIN_REVIEWS = 10;
const MOST_POPULAR_MIN_RATING = 4.5;

/**
 * Which notices this tour has earned, in display order.
 *
 * NOT the same call as `deriveTourBadge`. That one picks a SINGLE winner for a
 * listing card, where there is one badge slot and sponsored outranks everything
 * for transparency. Here there is room to stack, so a tour shows every signal it
 * genuinely carries and none it does not.
 *
 * Order is shopper-first rather than the master's priority order: urgency, then
 * social proof, then the paid-placement disclosure last. Sponsored ranks first
 * on a card because it must not be crowded out of the only slot - that reason
 * disappears once nothing can crowd it out.
 */
function deriveBookingNotices(detail: PublicTourDetail): BookingNoticeKind[] {
    const notices: BookingNoticeKind[] = [];
    // `override ?? computed` - the CMS override is authoritative when set, and
    // `false` is a meaningful override (suppress), so `??` not `||`.
    if (detail.likelyToSellOutOverride ?? detail.likelyToSellOut) {
        notices.push('likelyToSellOut');
    }
    if (
        detail.aggregateReviewCount >= MOST_POPULAR_MIN_REVIEWS &&
        (detail.aggregateRating ?? 0) >= MOST_POPULAR_MIN_RATING
    ) {
        notices.push('mostPopular');
    }
    // "Instant confirmation" affordance (master 6.1). Deliberately NOT a trust
    // line - LD5 locks the strip to exactly two lines - so it earns a notice
    // card beneath the widget instead, in the same shape as the other signals.
    if (detail.instantConfirmation) notices.push('instantConfirmation');
    if (detail.isSponsored) notices.push('sponsored');
    return notices;
}

export interface TourBookingData {
    /**
      * Display currency CODE, not a glyph.
      *
      * It used to be the glyph, which forced every price through a hand-rolled
      * `${symbol}${number}` concatenation - and `Intl` puts the euro sign AFTER
      * the number in de/nl/fr/es/pt. So a German shopper saw "€1.750" in the
      * booking card's price header and "1.750,00 €" in the alternatives row
      * directly beneath it. The code lets every surface use `Intl`.
      */
    currency: Currency;
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
    /** Optional extras (widget S4, master E.3); empty = no add-ons section. */
    addOns: BookingAddOn[];
    /** Pickup model: PAID_ADDON zones charge per person; NONE offers no pickup. */
    pickupModel: PickupModel;
    /** True when a pickup choice (zone or "other") is mandatory at reserve. */
    pickupRequired: boolean;
    /** Pickup zones for the checkout dropdown (display order, converted prices). */
    pickupOptions: BookingPickupOption[];
    /** Which notices render beneath the card, already in display order. */
    notices: BookingNoticeKind[];
}

/**
 * Dummy dataset for design work: a Pattern B (age-banded) tour with spectators
 * and mixed slot availability, so a single card exercises every screen -
 * calendar, slot states (available / "Only N left" / sold out), traveler
 * steppers, the spectators field, and the price summary + line-item breakdown.
 * Used as the `TourBookingCard` fallback when no live `data` is passed.
 */
export const DUMMY_BOOKING_DATA: TourBookingData = {
    currency: 'USD',
    priceFrom: 120,
    pricingModel: 'PER_PERSON',
    basePrice: 120,
    unitIncludedGuests: null,
    extraPersonPrice: 0,
    wholeUnitType: null,
    bookingType: null,
    bands: [
        {
            id: 'adult',
            kind: 'participant',
            label: 'Adult (age 13+)',
            price: 120,
            isDefault: true,
        },
        {
            id: 'child',
            kind: 'participant',
            label: 'Child (age 4-12)',
            price: 65,
            isDefault: false,
        },
        {
            id: 'infant',
            kind: 'participant',
            label: 'Infant (age 0-3)',
            price: 0,
            isDefault: false,
        },
        {
            id: 'spec-adult',
            kind: 'spectator',
            label: 'Adult (age 13+)',
            price: 20,
            isDefault: false,
        },
        {
            id: 'spec-kid',
            kind: 'spectator',
            label: 'Kid (age 4-12)',
            price: 10,
            isDefault: false,
        },
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
    // Two extras so the design card exercises both add-on units.
    addOns: [
        {
            id: 'demo-open-bar',
            name: 'Open bar upgrade',
            description: 'Unlimited local beer, rum punch & cocktails',
            price: 25,
            unit: 'PER_PERSON',
            maxQuantity: 1,
        },
        {
            id: 'demo-photos',
            name: 'GoPro photo package',
            description: 'Edited photos & video from your trip',
            price: 39,
            unit: 'FLAT',
            maxQuantity: 1,
        },
    ],
    pickupModel: 'PAID_ADDON',
    pickupRequired: false,
    pickupOptions: [
        { id: 'demo-hotel-zone', label: 'Hotel zone pickup', price: 12 },
        { id: 'demo-cruise', label: 'Cruise terminal pickup', price: 17 },
    ],
    // All of them, so the design/demo card exercises the full notice stack.
    notices: [
        'likelyToSellOut',
        'mostPopular',
        'instantConfirmation',
        'sponsored',
    ],
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

function mapBand(
    band: PublicTourAgeBand,
    conv: (v: string | number | null | undefined) => number
): BookingBand {
    return {
        id: band.id,
        kind: band.participation === 'SPECTATOR' ? 'spectator' : 'participant',
        label: band.label,
        price: conv(band.price),
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
export function buildTourBookingData(
    detail: PublicTourDetail
): TourBookingData {
    // Currency-aware display (guide §21.5): when the detail was fetched with a
    // shopper currency the backend attaches a converted `money` object; the widget
    // then shows that currency and converts every amount by the same rate. This is
    // the OPTIMISTIC pre-quote estimate only - the authoritative total comes from
    // POST /bookings/quote (§21.5 booking-widget rule 4).
    const displayCurrency = detail.money?.currency ?? detail.defaultCurrency;
    const fxRate = detail.money ? Number(detail.money.fxRate) || 1 : 1;
    const currency: Currency = isCurrency(displayCurrency)
        ? displayCurrency
        : 'USD';
    // Cents precision, never whole units: the widget must show the exact entered
    // price ($63.75 stays $63.75, not "$64") - founder rule 2026-07-16.
    const conv = (v: string | number | null | undefined) =>
        Math.round(toNumber(v) * fxRate * 100) / 100;

    const pricingModel = detail.pricingModel;
    const isUnit = pricingModel === 'UNIT';
    // The included-guests + extra-person surcharge applies ONLY to GROUP unit
    // pricing; boat/vehicle/aircraft/package charters are a flat whole-unit price.
    // Guarding here keeps the card correct even against stale data.
    const isGroupUnit = isUnit && detail.wholeUnitType === 'GROUP';
    const basePrice = conv(detail.basePrice ?? detail.priceFrom);
    const extraPersonPrice = isGroupUnit ? conv(detail.extraPersonPrice) : 0;
    // Headline: group base for UNIT, per-person "from" for PER_PERSON.
    const priceFrom = isUnit
        ? basePrice
        : conv(detail.priceFrom ?? detail.basePrice);

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
            ...spectators.map(b => mapBand(b, conv)),
        ];
    } else {
        bands = [...participants, ...spectators].map(b => mapBand(b, conv));
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

    // Optional extras (master E.3): converted like every other display price;
    // never pre-selected (master ethical CRO: "no pre-checked add-ons").
    const addOns: BookingAddOn[] = [...detail.addOns]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(a => ({
            id: a.id,
            name: a.name,
            description: a.description,
            price: conv(a.price),
            unit: a.unit,
            maxQuantity: a.maxQuantity,
        }));

    // Pickup zones (master 5.8). A zone price only means money on the
    // PAID_ADDON model - INCLUDED zones are free by definition.
    const isPaidPickup = detail.pickupModel === 'PAID_ADDON';
    const pickupOptions: BookingPickupOption[] = [...detail.pickupLocations]
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map(p => ({
            id: p.id,
            label: p.title || p.name,
            price:
                isPaidPickup && p.price != null && Number(p.price) > 0
                    ? conv(p.price)
                    : null,
        }));

    return {
        currency,
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
        addOns,
        pickupModel: detail.pickupModel,
        pickupRequired: detail.pickupRequired,
        pickupOptions,
        notices: deriveBookingNotices(detail),
    };
}
