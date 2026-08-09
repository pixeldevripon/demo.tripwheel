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
import type { PluralForms } from '@/lib/i18n/plural';
import { priceUnitLabel } from '@/lib/tours/pricing-label';
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
    soldOut: string;
    /** Calendar label for a day the tour does not run at all - NOT struck through. */
    calendarNoDepartures: string;
    /** Calendar label for a day past its booking cutoff (or closed by the operator). */
    calendarClosed: string;
    /** The line under the calendar explaining what a struck-out date means. */
    calendarLegend: string;
    /** Accessible name for the ring on today's date. */
    calendarToday: string;
    /** Shown when the chosen day has no bookable departure at all. */
    noDeparturesOnDateTitle: string;
    noDeparturesOnDateHint: string;
    /** All-sold-out dead end (AVAILABILITY-AND-DEPARTURES.md §8) - LOCKED headline.
     *  The spec fixes this wording: it is a promise about the rows beneath it. */
    deadEndTitle: string;
    /** Sub-line explaining why the calendar is gone. */
    deadEndSubtitle: string;
    /** Per-row next-departure line, e.g. "Next: {date}". */
    deadEndNext: string;
    /** Shown when the destination has nothing bookable this week either. */
    deadEndNoAlternatives: string;
    /**
     * "Only {count} left". PARKED for v1 (founder, 2026-08-07): both scarcity
     * signals - the chip sub-line and the date subscript - wait for live
     * per-departure capacity, because an unhonest one is worse than none. The
     * string stays so the wording does not have to be reinvented.
     */
    onlyLeft: string;
    /** "1 traveler" / "{count} travelers" - ICU plural categories, resolved via `formatPlural`. */
    travelers: PluralForms;
    /** "1 guest" / "{count} guests" - party header for a UNIT (whole-unit / charter) tour. */
    guests: PluralForms;
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
    /** Heading above the departure-time chips - shown only on a multi-departure tour. */
    departureTime: string;
    /**
     * Age-band nouns, keyed by `bandType`. `plural` is the ICU-category form used
     * in the price breakdown ("2 adults"); the panel row keeps the operator's own
     * noun and only borrows the age qualifier below.
     */
    bands: Record<string, { plural: PluralForms }>;
    /** "Age {min}+" - the qualifier on a band with no upper bound. */
    ageFrom: string;
    /** "Age {min}-{max}" - the qualifier on a bounded band. */
    ageRange: string;
    /** "Age up to {max}" - the qualifier on a band with no lower bound. */
    ageUpTo: string;
    total: string;
    payToday: string;
    balanceLater: string;
    /** Balance-row label for the `on_arrival` model ("Balance on arrival"). */
    balanceOnArrival: string;
    taxesIncluded: string;
    showDetails: string;
    /** The same toggle once the breakdown is open - a word, never a bare arrow. */
    hideDetails: string;
    /** Trust line with a `{link}` marker for the clickable part, e.g. "{link} up to {hours}h". */
    freeCancellation: string;
    /** Clickable/underlined phrase inside `freeCancellation` (opens the modal). */
    freeCancellationLink: string;
    /**
     * Deposit trust line, LOCKED and model-neutral: `{link}` marker + ", the
     * rest later". Both deposit models share it - the balance is not always
     * collected through a link, so the line must not say it is.
     */
    payLater: string;
    /** Clickable/underlined phrase inside the deposit trust line (opens the modal). */
    payLaterLink: string;
    /** Demand card copy, LOCKED by master §5.7 - headline + "Book today to
     *  secure your spot." Shown only when the §3.7 trigger fires. */
    sellOutTitle: string;
    sellOutSubtitle: string;
    // Booking Widget V2
    selectDate: string;
    /** Shown on the date field once a date is chosen - it edits, not selects. */
    change: string;
    checkAvailability: string;
    /** Inline CTA note when Check Availability is clicked with no date picked. */
    errorSelectDate: string;
    /** Inline CTA note when a date is picked but no departure time is. */
    errorSelectSlot: string;
    /** Shown in place of the CTA when the tour's payment model is not bookable in v1. */
    bookingUnavailable: string;
    apply: string;
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
    /** Add-ons section heading ("Optional extras") - widget S4 (master E.3). */
    addOnsTitle: string;
    /** Price suffix for a FLAT add-on ("per booking"); PER_PERSON reuses `perPerson`. */
    perBooking: string;
    /** Aria-label for the policy-modal close button. */
    policyClose: string;
    /**
     * "view policy" - appended to a trust link's accessible name so it reads as
     * an action ("Free cancellation, view policy") rather than a statement.
     */
    policyLinkHint: string;
    /** Free-cancellation policy modal (opened from the trust line). */
    cancellationModal: PolicyModalDict;
    /** Deposit / pay-later policy modal (opened from the trust line). */
    depositModal: PolicyModalDict;
};

/**
 * The localized price-unit suffix for a booking card ("per person" / "per
 * boat" / ...). Both the card's price header and the mobile sticky bar print
 * the same headline price, so they resolve its unit the same way.
 */
export function bookingUnitLabel(
    data: TourBookingData,
    dict: TourBookingDict
): string {
    return priceUnitLabel(
        { pricingModel: data.pricingModel, wholeUnitType: data.wholeUnitType },
        {
            per: dict.perPerson,
            perGroup: dict.perGroup,
            perBoat: dict.perBoat,
            perVehicle: dict.perVehicle,
            perAircraft: dict.perAircraft,
            perPackage: dict.perPackage,
        }
    );
}

/** A single priced row in the party selector (participant age band or spectator). */
export interface BookingBand {
    id: string;
    /** PARTICIPANT rows join the activity; SPECTATOR rows come along but don't. */
    kind: 'participant' | 'spectator';
    /** The operator's own label, e.g. "Adult (13+)". Free text, and English on
     *  every locale - the widget renders `bandLabel()` instead, which keeps the
     *  operator's NOUN and localizes the age qualifier around it. */
    label: string;
    /** ADULT / CHILD / INFANT / YOUTH / SENIOR - drives the fixed row order and
     *  the localized plural in the price breakdown ("2 adults"). */
    bandType: string;
    /** Inclusive age bounds; either may be null (no bound on that side). */
    minAge: number | null;
    maxAge: number | null;
    /** Per-person price in the tour's default currency (0 = free, e.g. infants). */
    price: number;
    /** The band pre-selected with a starting count (the tour's default age band). */
    isDefault: boolean;
}

/**
 * The order the party rows are shown in - adults, then children, then infants -
 * both in the panel and in the price breakdown (Pastel #58).
 *
 * Fixed, NOT the operator's `displayOrder`: that is assigned in the order the
 * bands happened to be created, so adding an infant band to a live tour dropped
 * its row between Adult and Child. A traveller reads the party by age, and the
 * age order does not depend on when the operator typed it in.
 *
 * Anything unrecognised sorts last rather than first: an unknown type is a band
 * we cannot place, and guessing the top of the list is the louder mistake.
 */
const BAND_TYPE_ORDER = ['ADULT', 'SENIOR', 'YOUTH', 'CHILD', 'INFANT'];

export function bandTypeRank(bandType: string): number {
    const i = BAND_TYPE_ORDER.indexOf(bandType);
    return i === -1 ? BAND_TYPE_ORDER.length : i;
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

/**
 * Whether the §3.7 demand card renders below the widget - the ONE thing master
 * §5.7 puts in that slot, and nothing else. The client emptied the rest of the
 * stack out of it (Pastel #52/#53): Instant confirmation (LD5 exclusion, already
 * page-level on the All Tours trust strip), Sponsored (discloses a paid POSITION
 * in a ranked list; a tour's own page has no position to disclose) and Most
 * popular (a §3.6 LISTING-CARD badge, never part of §5.7 - the page already
 * carries the real rating, a review preview and a Reviews section).
 *
 * `override ?? computed`: the CMS override is authoritative when set, and
 * `false` is a meaningful override (suppress), so `??` not `||`. At launch the
 * override IS the signal - no tour has 90 days of history yet - and it is set on
 * a handful of tours by hand, never catalog-wide. Expected coverage ~5-10%;
 * selectivity is the feature.
 */
function deriveShowDemandCard(detail: PublicTourDetail): boolean {
    return detail.likelyToSellOutOverride ?? detail.likelyToSellOut;
}

/** Everything the booking widget needs, resolved from a single tour fetch. */
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
    /** Whether the §5.7 demand card renders beneath the card (master §3.7 gate). */
    showDemandCard: boolean;
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
            label: 'Adult',
            bandType: 'ADULT',
            minAge: 13,
            maxAge: null,
            price: 120,
            isDefault: true,
        },
        {
            id: 'child',
            kind: 'participant',
            label: 'Child',
            bandType: 'CHILD',
            minAge: 4,
            maxAge: 12,
            price: 65,
            isDefault: false,
        },
        {
            id: 'infant',
            kind: 'participant',
            label: 'Infant',
            bandType: 'INFANT',
            minAge: 0,
            maxAge: 3,
            price: 0,
            isDefault: false,
        },
        {
            id: 'spec-adult',
            kind: 'spectator',
            label: 'Adult',
            bandType: 'ADULT',
            minAge: 13,
            maxAge: null,
            price: 20,
            isDefault: false,
        },
        {
            id: 'spec-kid',
            kind: 'spectator',
            label: 'Kid',
            bandType: 'CHILD',
            minAge: 4,
            maxAge: 12,
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
    // Both of them, so the design/demo card exercises the full notice stack.
    // On, so the design/demo card exercises the slot at all.
    showDemandCard: true,
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
    priceOf: (band: PublicTourAgeBand) => number
): BookingBand {
    return {
        id: band.id,
        kind: band.participation === 'SPECTATOR' ? 'spectator' : 'participant',
        label: band.label,
        bandType: band.bandType,
        minAge: band.minAge,
        maxAge: band.maxAge,
        price: priceOf(band),
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

    /**
     * A retail amount the BACKEND has already converted, in the backend's own
     * rounding (`retailWhole` - ceil to a whole currency unit, guide §20.9).
     *
     * Every traveller-facing price in this widget comes through here. Doing the
     * multiply locally instead produced numbers the backend would never produce,
     * in two visible ways: the headline disagreed with the tour card that linked
     * here (the card's served "128" against the widget's own 139 x 0.92 =
     * 127.88, on one page), and the add-on and band rows carried cents on a
     * platform where every other traveller-facing amount is a whole unit - a $39
     * add-on rendering as "35,88 EUR" (Pastel #41; founder 2026-08-06: the
     * rounded converted price on the tour card "also should show in booking
     * card", "this will serve from backend", and "addons and extras still
     * showing floated converted price, it should show ceiled price").
     *
     * `conv` survives only as the fallback for a payload with no `money` object:
     * a same-currency shopper, an FX outage where the backend serves source
     * prices at rate 1, or a `'use cache'` entry written before this field
     * existed. In those cases there is nothing served to prefer.
     */
    const served = (
        backendValue: string | null | undefined,
        sourceValue: string | number | null | undefined
    ) => (backendValue != null ? toNumber(backendValue) : conv(sourceValue));

    /** Age-band price, served where the backend converted it. */
    const bandPrice = (b: PublicTourAgeBand) =>
        served(detail.money?.ageBands?.[b.id], b.price);

    const pricingModel = detail.pricingModel;
    const isUnit = pricingModel === 'UNIT';
    // The included-guests + extra-person surcharge applies ONLY to GROUP unit
    // pricing; boat/vehicle/aircraft/package charters are a flat whole-unit price.
    // Guarding here keeps the card correct even against stale data.
    const isGroupUnit = isUnit && detail.wholeUnitType === 'GROUP';
    const basePrice = served(
        detail.money?.basePrice ?? detail.money?.priceFrom,
        detail.basePrice ?? detail.priceFrom
    );
    const extraPersonPrice = isGroupUnit
        ? served(detail.money?.extraPersonPrice, detail.extraPersonPrice)
        : 0;
    // Headline: group base for UNIT, per-person "from" for PER_PERSON.
    const priceFrom = isUnit
        ? basePrice
        : served(
              detail.money?.priceFrom ?? detail.money?.basePrice,
              detail.priceFrom ?? detail.basePrice
          );

    const ordered = [...detail.ageBands].sort(
        (a, b) => a.displayOrder - b.displayOrder
    );
    // Participants come out in the fixed age order (see BAND_TYPE_ORDER), with
    // the operator's `displayOrder` only breaking a tie between two bands of the
    // same type. Spectators keep the operator's order - they are a short list
    // with no age story to tell.
    const participants = ordered
        .filter(b => b.participation !== 'SPECTATOR')
        .sort(
            (a, b) =>
                bandTypeRank(a.bandType) - bandTypeRank(b.bandType) ||
                a.displayOrder - b.displayOrder
        );
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
                bandType: 'ADULT',
                minAge: null,
                maxAge: null,
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
                bandType: 'ADULT',
                minAge: null,
                maxAge: null,
                price: priceFrom,
                isDefault: true,
            },
            ...spectators.map(b => mapBand(b, bandPrice)),
        ];
    } else {
        bands = [...participants, ...spectators].map(b =>
            mapBand(b, bandPrice)
        );
    }

    // NOT rounded. Tier rates run 20-30 in steps of 2.5 (master LD24), so
    // `Math.round` turned a real 27.5% tour into "Pay only 28% today" and made
    // the widget's own deposit estimate disagree with the server quote by half
    // a percent. `String(27.5)` is "27.5" and `String(30)` is "30", so the copy
    // still reads clean on whole rates.
    const depositPct = toNumber(detail.depositPct);
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
            price: served(detail.money?.addOns?.[a.id], a.price),
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
                    ? served(detail.money?.pickupLocations?.[p.id], p.price)
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
        showDemandCard: deriveShowDemandCard(detail),
    };
}
