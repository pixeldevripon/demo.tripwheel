/**
 * booking-store (Zustand, per-card instance)
 *
 * Holds the tour booking widget's coordinated pre-checkout flow (date -> time ->
 * party -> price). Unlike the global upload store, one store is created PER card
 * from its tour `data`/`dict`/`locale` (via `createBookingStore`) and handed to
 * the tree through `BookingStoreProvider` - so two cards never share counts and a
 * card resets cleanly when the tour route remounts.
 *
 * The store owns only source-of-truth state + actions + the static config the
 * actions need. All read-only derived values (totals, capacity, flow flags,
 * money/copy formatters) are computed by `deriveBooking()` and surfaced through
 * the `useBooking()` hook, so there is exactly one place that math lives.
 */

import type { BookingQuote } from '@/lib/api/bookings';
import { depositToday, formatCheckoutMoney } from '@/lib/checkout/checkout';
import type { Currency, Locale } from '@/lib/constants/locales';
import { bandCountLabel as sharedBandCountLabel } from '@/lib/tours/band-label';
import {
    DUMMY_BOOKING_DATA,
    type BookingBand,
    type BookingSlot,
    type TourBookingData,
    type TourBookingDict,
} from '@/lib/tours/booking';
import { createStore } from 'zustand';

/** Which policy modal (if any) is open, opened from the trust lines. */
export type PolicyModalKind = null | 'cancellation' | 'deposit';

/**
 * The traveler's widget selection as persisted to sessionStorage (per tour),
 * so a checkout round-trip ("Back to tour") restores what they picked. `date`
 * is a local `YYYY-MM-DD`; zero-count rows are omitted from both maps.
 */
export interface PersistedBookingSelection {
    date: string | null;
    time: string | null;
    counts: Record<string, number>;
    addOnQty: Record<string, number>;
    /** Checkout pickup select value ('none' | 'other' | a zone id) - written by
     *  the checkout page into the same per-tour key; the widget ignores it. */
    pickup?: string | null;
}

/** Per-day availability for the month calendar (from `/availability/calendar`). */
export interface CalendarDayState {
    available: boolean;
    status: string;
    remaining: number | null;
}

/**
 * The all-sold-out dead end (AVAILABILITY-AND-DEPARTURES.md §8) opens when a tour
 * has no open departure in the next 30 days - the same horizon the nightly job
 * uses for `isBookable`, so the widget and the ranking engine agree on what "sold
 * out" means.
 */
export const DEAD_END_HORIZON_DAYS = 30;

/**
 * Whether `days` holds at least one available date within `horizonDays` of today
 * (inclusive). Compares `yyyy-MM-dd` keys as strings - they sort lexicographically
 * and the calendar map is already keyed that way, so no per-day Date parsing.
 */
function hasOpenDayWithin(
    days: Record<string, CalendarDayState>,
    horizonDays: number
): boolean {
    const now = new Date();
    const key = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
            d.getDate()
        ).padStart(2, '0')}`;
    const from = key(now);
    const to = key(
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + horizonDays)
    );
    for (const [date, state] of Object.entries(days)) {
        if (state.available && date >= from && date <= to) return true;
    }
    return false;
}

/** A single band row for the price breakdown (band + its chosen count). */
export type BookingLineItem = { band: BookingBand; count: number };

/**
 * A rendered price-breakdown row: `text` is the full left-hand label (e.g.
 * "2 adults × $120" or "Charter (up to 10 guests)"), `amount` the right-hand
 * money value. Both pricing models produce these so the summary renders one way.
 *
 * A row with `amount: 0` is a real, chosen row - an infant band, say - and the
 * summary prints "Free" against it rather than a formatted zero. The master
 * bans zero rows for bands nobody picked; a band that WAS picked should read
 * like a fact, not like arithmetic about nothing (Pastel #58).
 */
export type PriceRow = { id: string; text: string; amount: number };

/**
 * The payment trust line rendered under free-cancellation - LD5 line 2, and the
 * ONLY thing that may sit there. It carries a clickable `{link}` phrase that
 * opens the deposit modal, and it exists **only on a tour that actually takes a
 * deposit online** (`requiresDeposit`).
 *
 * `null` everywhere else: master conflict log 81 / B.81 locks the strip to the
 * single cancellation line on `paid_in_full` and `operator_full`. It used to
 * carry a second `plain` variant here - a static "Pay in full now" on
 * `paid_in_full` - which is exactly the promise the client asked us to stop
 * making on tours that do not take a deposit.
 */
export type PaymentTrust = {
    before: string;
    link: string;
    after: string;
} | null;

/** Static, per-tour configuration derived once when the store is created. */
export interface BookingConfig {
    data: TourBookingData;
    dict: TourBookingDict;
    locale: Locale;
    /** Live tour id - enables real availability (calendar + per-date slots). When
     *  absent (design/demo), the card falls back to the static `data.slots` and an
     *  always-open calendar. */
    tourId?: string;
    /** Destination + tour slug for the checkout URL on Continue (optional: the
     *  card still works in isolation, e.g. design/demo, when they're absent). */
    destinationSlug?: string;
    tourSlug?: string;
    /** Shopper (booking) currency - sent to `POST /bookings/quote` and carried to
     *  checkout so the authoritative total is priced in it (guide §21.5). */
    currency?: Currency;
    /**
     * The date the traveller arrived with, if the URL carried one. Kept so the
     * persisted selection cannot overwrite it: a sessionStorage snapshot from a
     * previous visit to this tour is OLDER intent than the search they just ran.
     */
    initialDate?: string;
    participantBands: BookingBand[];
    spectatorBands: BookingBand[];
    hasSpectators: boolean;
    /** Pattern B = >1 participant band or spectators (expandable steppers). */
    isPatternB: boolean;
    maxParty: number;
}

/** Mutable source-of-truth state for the flow. */
export interface BookingState {
    counts: Record<string, number>;
    /** Chosen quantity per add-on id (zero rows omitted; never pre-selected). */
    addOnQty: Record<string, number>;
    selectedDate: Date | null;
    selectedTime: string | null;
    calendarOpen: boolean;
    partyOpen: boolean;
    detailsOpen: boolean;
    spectatorsOn: boolean;
    /** The spectators field only surfaces once the traveller count is touched. */
    travelerTouched: boolean;
    spectatorsApplied: boolean;
    policyModal: PolicyModalKind;
    /** Month-calendar availability keyed by `yyyy-MM-dd`; null until first load
     *  (live mode only - stays null in demo/design mode). */
    calendarDays: Record<string, CalendarDayState> | null;
    calendarLoading: boolean;
    /** True when the last calendar fetch FAILED. The sync hook fails open to an
     *  empty map so a transient error never blanks the calendar - but an empty
     *  map is also exactly what a genuinely sold-out tour returns, so the dead
     *  end has to be able to tell the two apart. */
    calendarError: boolean;
    /** Real bookable slots for `selectedDate`; null until fetched for the current
     *  date (live mode only). */
    daySlots: BookingSlot[] | null;
    slotsLoading: boolean;
    /** Server-authoritative quote for the current selection (live mode); null until
     *  a complete selection resolves one. When present it drives the money summary,
     *  never the client math (guide §21.5). */
    quote: BookingQuote | null;
    quoteLoading: boolean;
    /** True when the last quote attempt failed - the card falls back to the
     *  optimistic client estimate rather than blocking. */
    quoteError: boolean;
    /** Which required selection blocked the last CTA click (null = none). Drives
     *  the inline note above the CTA and the highlight on the missing field;
     *  cleared as soon as that selection is made. */
    ctaError: 'date' | 'slot' | null;
    /** Bumped on EVERY blocked CTA click, even when `ctaError` lands on the same
     *  value as last time. Without it a second click is a no-op state write, so
     *  the highlight animation has nothing to react to and only ever plays once
     *  - the user hits Checkout again, sees nothing move, and reads the button
     *  as broken. Consumers watch this, not `ctaError`, to replay. */
    ctaErrorNonce: number;
}

/** Everything the sections can trigger. */
export interface BookingActions {
    setCalendarOpen: (open: boolean) => void;
    toggleCalendar: () => void;
    togglePartyOpen: () => void;
    toggleDetails: () => void;
    setSpectatorsOn: (on: boolean) => void;
    setSpectatorsApplied: (applied: boolean) => void;
    setPolicyModal: (kind: PolicyModalKind) => void;
    setBandCount: (band: BookingBand, next: number) => void;
    /** Set an add-on's quantity (clamped 0..maxQuantity). */
    setAddOnQty: (addOnId: string, next: number) => void;
    /** Restore a persisted selection (date/party/extras) after a checkout
     *  round-trip. Validates everything against the CURRENT tour data; the
     *  time is NOT restored here - the persistence hook re-selects it once the
     *  date's live slots confirm it still exists. */
    hydrateSelection: (sel: PersistedBookingSelection) => void;
    clearSpectatorCounts: () => void;
    pickDate: (date: Date) => void;
    selectTime: (time: string) => void;
    handleCtaClick: () => void;
    /** Set by the availability sync once the calendar range resolves. Pass
     *  `failed` when the fetch errored and the map is the fail-open fallback. */
    setCalendarDays: (
        days: Record<string, CalendarDayState>,
        failed?: boolean
    ) => void;
    setCalendarLoading: (loading: boolean) => void;
    /** Set by the availability sync once slots for the picked date resolve. */
    setDaySlots: (slots: BookingSlot[]) => void;
    setSlotsLoading: (loading: boolean) => void;
    /** Set by the quote sync as the server quote resolves / fails / clears. */
    setQuote: (quote: BookingQuote | null) => void;
    setQuoteLoading: (loading: boolean) => void;
    setQuoteError: (error: boolean) => void;
}

export type BookingStore = BookingConfig & BookingState & BookingActions;

/** Props used to seed a fresh store (falls back to the design/demo dataset). */
export interface BookingInit {
    dict: TourBookingDict;
    data?: TourBookingData;
    locale?: Locale;
    tourId?: string;
    destinationSlug?: string;
    tourSlug?: string;
    currency?: Currency;
    /**
     * A date the traveller already chose BEFORE reaching this page - carried in
     * the URL (`?date=`) from a search or listing they filtered by day. Local
     * `YYYY-MM-DD`.
     *
     * Seeded as the widget's selection so the answer to "can I do this on the
     * 27th" is not asked twice. It is a starting point, not a commitment: the
     * calendar is untouched and re-picking overrides it.
     */
    initialDate?: string;
}

/* ─── Pure derivations (from a full store snapshot) ───────────────────────── */

function travelerCountOf(s: BookingConfig & BookingState): number {
    return s.data.bands.reduce((n, b) => n + (s.counts[b.id] ?? 0), 0);
}

// The slots in effect right now: live per-date departures when a tour id is set
// (booking), else the tour's static start times (design/demo).
function effectiveSlotsOf(s: BookingConfig & BookingState): BookingSlot[] {
    return s.tourId != null ? (s.daySlots ?? []) : s.data.slots;
}

// Largest party allowed right now: the tour max, further capped by the slot's
// true seats left (`seatsLeft`, always known). Falls back to the disclosed
// `remaining` for the demo dataset, then to the tour max (ample room).
function effectiveMaxOf(s: BookingConfig & BookingState): number {
    if (s.selectedTime == null) return s.maxParty;
    const slot =
        effectiveSlotsOf(s).find(x => x.time === s.selectedTime) ?? null;
    const slotCapacity = slot?.seatsLeft ?? slot?.remaining ?? s.maxParty;
    return Math.min(s.maxParty, slotCapacity);
}

// The default band's floor stays ≥0 but is usually 1 (min party size).
function partyMinOf(s: BookingConfig, band: BookingBand): number {
    const defaultBand =
        s.participantBands.find(b => b.isDefault) ?? s.participantBands[0];
    return band === defaultBand ? Math.min(1, s.data.minPartySize) : 0;
}

/**
 * Travellers on a PRICED band - the ceiling for a per-person extra.
 *
 * Mirrors the backend's `payingPax`: a free band (infants) takes a seat and
 * counts toward capacity, but is not somebody you buy an open bar for. On a
 * charter every guest is covered by the price paid, so all of them count.
 */
function payingCountOf(s: BookingConfig & BookingState): number {
    if (s.data.pricingModel === 'UNIT') return travelerCountOf(s);
    return s.data.bands.reduce(
        (n, b) => (b.price > 0 ? n + (s.counts[b.id] ?? 0) : n),
        0
    );
}

/**
 * The most of one add-on a booking may hold. Mirrors the backend's
 * `addOnQuantityCap` exactly, so a quantity the stepper refuses to offer is
 * also one the quote refuses to price.
 *
 * The stepper counts UNITS and the unit is whatever the price line says
 * (Pastel #58): a "per person" extra stops at the paying travellers, a "per
 * booking" extra stops at one - it cannot be bought twice - and the operator's
 * own `maxQuantity` can only lower either.
 */
export function addOnMaxOf(
    addOn: { unit: string; maxQuantity: number },
    payingCount: number
): number {
    const byUnit = addOn.unit === 'PER_PERSON' ? payingCount : 1;
    return Math.max(0, Math.min(addOn.maxQuantity, byUnit));
}

/** The full read-only view every section consumes (via `useBooking()`). */
export function deriveBooking(s: BookingStore) {
    const travelerCount = travelerCountOf(s);
    const effectiveMax = effectiveMaxOf(s);
    const overCapacity = s.selectedTime != null && travelerCount > effectiveMax;

    // At (or over) the cap the plus button is disabled, so the widget must say
    // WHY (master §3.3.1: "plus button disables at capacity, inline Only N left").
    // Slot scarcity (fewer true seats than the tour normally allows) earns the
    // "Only N left" copy; the tour's per-booking max earns a neutral limit line
    // (no fake scarcity - master ethical CRO).
    const atCapacity = effectiveMax > 0 && travelerCount >= effectiveMax;
    const selectedSlot =
        s.selectedTime != null
            ? (effectiveSlotsOf(s).find(x => x.time === s.selectedTime) ?? null)
            : null;
    const slotSeatsLeft = selectedSlot
        ? (selectedSlot.seatsLeft ?? selectedSlot.remaining ?? null)
        : null;
    const capacityReason: 'slot' | 'booking' =
        slotSeatsLeft != null && slotSeatsLeft < s.maxParty
            ? 'slot'
            : 'booking';

    // Live availability: real per-date slots + month calendar when a tour id is
    // set; otherwise the static demo slots and an always-open calendar.
    const isLive = s.tourId != null;
    const slots = effectiveSlotsOf(s);

    // All-sold-out dead end (AVAILABILITY-AND-DEPARTURES.md §8): the widget shows
    // alternatives instead of a calendar with nothing in it.
    //
    // Three deliberate guards, each of which would otherwise produce a false
    // positive: demo/design mode has no backend at all; a still-loading calendar
    // is `null`, not empty; and a FAILED fetch fills the map with `{}` on purpose
    // (fail open), which is byte-identical to a genuinely sold-out tour. Only a
    // successful load that came back with no open day inside the horizon counts.
    const availabilityDeadEnd =
        isLive &&
        !s.calendarError &&
        s.calendarDays != null &&
        !hasOpenDayWithin(s.calendarDays, DEAD_END_HORIZON_DAYS);

    // Readiness (price block shown, CTA reads "Continue"). The backend already
    // pre-verified availability - the calendar only offers open days and
    // `/availability/check` only returns bookable slots - so a complete,
    // in-capacity selection is ready the moment it is complete. There is
    // nothing left to check.
    //
    // The design/demo card used to keep a second, explicit "Check availability"
    // click before showing a price. The client killed it (Pastel #58): with a
    // date chosen and the departure already on screen, "Check availability" is a
    // question the widget has just answered. The party stays editable
    // throughout, and the price moves on every plus and minus.
    const selectionComplete =
        s.selectedDate != null &&
        s.selectedTime != null &&
        travelerCount >= 1 &&
        !overCapacity;
    const ready = selectionComplete;
    const editingParty = true;

    // ONE formatter for the whole funnel. This was a verbatim copy of
    // `formatCheckoutMoney` - same expression, same docblock - so the widget and
    // the checkout summary could drift apart across a single navigation.
    const money = (n: number) =>
        formatCheckoutMoney(n, s.data.currency, s.locale);

    /**
     * The band's age qualifier, localized: "Age 13+", "Age 4-12", "Age up to 3".
     * Null when the band carries no bounds at all - there is nothing to say.
     *
     * The word "Age" is part of it by client instruction (Pastel #58): "Adult
     * (13+)" reads as a price tier, "Adult (Age 13+)" reads as a rule.
     */
    const bandAgeLabel = (band: BookingBand): string | null => {
        if (band.minAge != null && band.maxAge != null) {
            return s.dict.ageRange
                .replace('{min}', String(band.minAge))
                .replace('{max}', String(band.maxAge));
        }
        if (band.minAge != null) {
            return s.dict.ageFrom.replace('{min}', String(band.minAge));
        }
        if (band.maxAge != null) {
            return s.dict.ageUpTo.replace('{max}', String(band.maxAge));
        }
        return null;
    };

    /**
     * The party-row label: the operator's own noun with a localized age
     * qualifier around it - "Adult (Age 13+)".
     *
     * The noun is kept rather than swapped for the band TYPE's word so an
     * operator who named a band "Student" still gets "Student", and any age
     * qualifier they typed by hand ("Adult (13+)") is dropped in favour of the
     * localized one - otherwise a Dutch traveller reads a bracket in English.
     */
    const bandLabel = (band: BookingBand): string => {
        const noun = band.label.split(' (')[0].trim() || band.label;
        const age = bandAgeLabel(band);
        return age ? `${noun} (${age})` : noun;
    };

    /**
     * The breakdown label for a chosen band: "2 adults", "1 infant". Shared
     * with the checkout summary, which shows the same booking one navigation
     * later - see `lib/tours/band-label.ts`.
     */
    const bandCountLabel = (band: BookingBand, count: number): string =>
        sharedBandCountLabel(band, count, s.dict.bands, s.locale);

    // Price breakdown rows + grand total, per pricing model.
    const isUnit = s.data.pricingModel === 'UNIT';
    let priceRows: PriceRow[];
    let total: number;
    if (isUnit) {
        // Whole-unit charter (master §3.2): base covers up to
        // `unitIncludedGuests`; each guest beyond that adds `extraPersonPrice`.
        const guests = travelerCount;
        const included = s.data.unitIncludedGuests ?? guests;
        const extra = Math.max(0, guests - included);
        priceRows = [
            {
                id: 'charter',
                text: s.dict.unitCharterLine.replace(
                    '{count}',
                    String(included)
                ),
                amount: s.data.basePrice,
            },
        ];
        if (extra > 0) {
            priceRows.push({
                id: 'extra-guests',
                text: `${s.dict.unitExtraGuests} × ${extra} × ${money(
                    s.data.extraPersonPrice
                )}`,
                amount: extra * s.data.extraPersonPrice,
            });
        }
        total = s.data.basePrice + extra * s.data.extraPersonPrice;
    } else {
        // "2 adults × $150", not "Adult x 2 x $150" (Pastel #58). A free band
        // drops the "× $0" tail entirely and reads "1 infant" - the summary
        // prints "Free" in the amount column against it.
        priceRows = s.data.bands
            .map(b => ({ band: b, count: s.counts[b.id] ?? 0 }))
            .filter(row => row.count > 0)
            .map(({ band, count }) => {
                const lead =
                    band.kind === 'spectator'
                        ? `${count} ${s.dict.spectators}`
                        : bandCountLabel(band, count);
                return {
                    id: band.id,
                    text:
                        band.price > 0
                            ? `${lead} × ${money(band.price)}`
                            : lead,
                    amount: count * band.price,
                };
            });
        total = priceRows.reduce((sum, r) => sum + r.amount, 0);
    }

    // ── Optional extras (master E.3): charged by the quantity picked, whatever
    // the unit. Mirrors the backend add-on math exactly, so the optimistic
    // estimate matches the quote that replaces it below. Rows fold into the same
    // breakdown as the participant lines. Tracked separately from the tour
    // total: extras are excluded from the deposit-% base and charged 100% up
    // front (founder 2026-07-25).
    //
    // This used to multiply a PER_PERSON extra by the party on top of the
    // quantity the traveller picked, so two adults adding one open bar were
    // charged $44 for a $22 extra (Pastel #58). The stepper counts UNITS and the
    // unit is whatever the price line says: "$22 per person" means one step is
    // one person. Two open bars for two adults is the traveller's choice to
    // make, not ours to assume - which is what `addOnMax` is for.
    const tourTotal = total;
    let extrasTotal = 0;
    for (const addOn of s.data.addOns) {
        const qty = s.addOnQty[addOn.id] ?? 0;
        if (qty <= 0) continue;
        const amount = Math.round(qty * addOn.price * 100) / 100;
        priceRows.push({
            id: `addon-${addOn.id}`,
            text: `${addOn.name} × ${qty}`,
            amount,
        });
        extrasTotal += amount;
    }
    total += extrasTotal;

    // ── Payment-model conditional (master §3.1 / §5.8 / §6.1) ────────────────
    // The card's money rows, CTA label, and trust lines are all driven by the
    // tour's real `paymentModel` + `depositPct`.
    const paymentModel = s.data.paymentModel;
    const isOperatorFull = paymentModel === 'OPERATOR_FULL';
    // operator_full is dropped in v1 (founder decision, SETTLEMENT-AND-PAYOUTS):
    // the widget must never offer a payment-free reserve. A tour still carrying
    // it is not bookable here.
    const bookingBlocked = isOperatorFull;

    // "Does this tour actually take a deposit online" - a deposit model AND a
    // percentage that leaves something for later (0 < pct < 100). Read the
    // canonical flag from `lib/tours/booking.ts` rather than recomputing it:
    // this was a second copy of the same expression, and the copy is what the
    // trust line has to agree with.
    const usesDeposit = s.data.requiresDeposit;
    // Shared with the checkout summary (`depositToday`) so the widget and the
    // page one navigation later cannot round the same split two ways. Whole
    // units, always up - matching the backend's `splitDeposit`, so the quote's
    // amounts replace this estimate without the figure visibly jumping. The %
    // applies to the TOUR price only; extras ride the balance in full (founder
    // 2026-07-25).
    let payToday = usesDeposit
        ? depositToday(tourTotal, s.data.depositPct)
        : isOperatorFull
          ? 0
          : total;
    let balanceLater = total - payToday;

    // ── Server-authoritative quote (guide §21.5) ─────────────────────────────
    // When a fresh quote is loaded it - not the client math - drives the money
    // summary + breakdown (its amounts are already in the shopper currency, rounded
    // 2dp). During a refetch (`quoteLoading`) or on error the card keeps the
    // optimistic client estimate above, so it stays responsive and never blocks.
    const useQuote = s.quote != null && !s.quoteLoading && !s.quoteError;
    if (useQuote && s.quote) {
        const q = s.quote;
        total = Number(q.totalRetail);
        payToday = Number(q.depositAmount);
        balanceLater = Number(q.balanceAmount);
        // Rebuild the breakdown from the quote lines so it reconciles to the
        // total - in the SAME voice as the client rows above. It used to render
        // "Adult x 2 x $139" here while the optimistic estimate rendered "2
        // adults × $139", so the wording the client signed off on lasted only
        // until the server quote landed and silently replaced it.
        priceRows = q.lines.map((l, i) => {
            const band =
                l.kind === 'participant' && l.ageBandId
                    ? s.data.bands.find(b => b.id === l.ageBandId)
                    : undefined;
            const unitPrice = Number(l.unitPrice);
            const lead = band
                ? band.kind === 'spectator'
                    ? `${l.quantity} ${s.dict.spectators}`
                    : bandCountLabel(band, l.quantity)
                : l.kind === 'participant'
                  ? `${l.quantity} ${l.label}`
                  : `${l.label} × ${l.quantity}`;
            return {
                id: `${l.kind}-${l.ageBandId ?? i}`,
                // A free band, and every extra (its unit price is already in the
                // name), drop the "× price" tail.
                text:
                    l.kind === 'participant' && unitPrice > 0
                        ? `${lead} × ${money(unitPrice)}`
                        : lead,
                amount: Number(l.lineTotal),
            };
        });
    }

    // Money rows: hide zero-amount rows (master §6.1).
    const showPayToday = payToday > 0;
    const showBalance = balanceLater > 0;
    const balanceLabel =
        paymentModel === 'ON_ARRIVAL'
            ? s.dict.balanceOnArrival
            : s.dict.balanceLater;

    // Interpolate policy-copy placeholders from the live tour data.
    const fillPolicy = (str: string) =>
        str
            .replace(/\{hours\}/g, String(s.data.cancellationHours))
            .replace(/\{pct\}/g, String(s.data.depositPct));

    // Payment trust line (LD5 line 2, below free-cancellation). It promises a
    // payment term - "Pay only {pct}% today, the rest later" - so it renders
    // ONLY where that term is real: a deposit model with a percentage that
    // leaves a balance. `paid_in_full`, `operator_full`, a 0% or 100% deposit,
    // and any payment model we do not recognise all fall through to `null`,
    // leaving the strip as the single cancellation line (master conflict log 81
    // / B.81). Fail closed: never promise a term we cannot honour.
    //
    // The tail is the LOCKED neutral "the rest later" (LD5 / B.2), one string
    // for both deposit models. It carried model-specific tails - "the rest via
    // the operator's secure link" and "the rest on arrival" - which is exactly
    // the wording the client rejected: the rest is not always paid through a
    // link. How the balance is actually collected belongs in the deposit modal
    // (B.88 gives it the on_arrival variant), not on the commit-moment line.
    const paymentTrust: PaymentTrust = usesDeposit
        ? (() => {
              const [before, after] = fillPolicy(s.dict.payLater).split(
                  '{link}'
              );
              return {
                  before,
                  link: fillPolicy(s.dict.payLaterLink),
                  after,
              };
          })()
        : null;

    // "$150 per person", not "$150/per person" (Pastel #58).
    const bandPriceLabel = (band: BookingBand): string =>
        band.price > 0
            ? `${money(band.price)} ${s.dict.perPerson}`
            : s.dict.free;

    const partyMin = (band: BookingBand) => partyMinOf(s, band);

    // Travellers on a priced band - the ceiling for a per-person extra.
    const payingCount = payingCountOf(s);
    const addOnMax = (addOn: { unit: string; maxQuantity: number }) =>
        addOnMaxOf(addOn, payingCount);

    // Pattern A gets an inline header stepper, Pattern B gets a chevron that
    // expands its age-band steppers from its own header - the same way the
    // extras block opens and closes. Neither has an Apply: the price moves on
    // every plus and minus (Pastel #58).
    const headerHasChevron = s.isPatternB;
    const showInlineStepper = !s.isPatternB;
    const showPartyBody = s.isPatternB && s.partyOpen;

    return {
        travelerCount,
        effectiveMax,
        overCapacity,
        atCapacity,
        capacityReason,
        ready,
        editingParty,
        isUnit,
        priceRows,
        total,
        payToday,
        balanceLater,
        showPayToday,
        showBalance,
        balanceLabel,
        bookingBlocked,
        paymentTrust,
        money,
        fillPolicy,
        bandPriceLabel,
        bandLabel,
        payingCount,
        addOnMax,
        partyMin,
        headerHasChevron,
        showInlineStepper,
        showPartyBody,
        isLive,
        slots,
        // Real departure id for the current time selection (live mode); the quote
        // and reserve calls key off this. Null in design/demo mode.
        selectedDepartureId: selectedSlot?.departureId ?? null,
        slotsLoading: s.slotsLoading,
        calendarDays: s.calendarDays,
        calendarLoading: s.calendarLoading,
        availabilityDeadEnd,
        // Server-authoritative quote for the current selection + its load state
        // (the summary can show a subtle refresh; the CTA carries `quote.quoteId`
        // to checkout). `usingQuote` is true when the summary reflects the quote.
        quote: s.quote,
        quoteLoading: s.quoteLoading,
        usingQuote: useQuote,
    };
}

/* ─── Store factory ──────────────────────────────────────────────────────── */

/**
 * A local `YYYY-MM-DD` as a Date at LOCAL midnight, or null when it is
 * malformed or already past.
 *
 * Local, never `new Date(iso)`: that parses as UTC midnight and lands on the
 * previous day everywhere west of Greenwich, so the widget would open on a
 * different date than the one the traveller searched.
 */
export function parseLocalDateParam(
    value: string | null | undefined
): Date | null {
    if (typeof value !== 'string') return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    if (Number.isNaN(date.getTime())) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date >= today ? date : null;
}

/**
 * The one bookable time, when the date offers exactly one departure - else null.
 *
 * A date with a single departure shows no chip row at all (Pastel #58: "the
 * picker only belongs on tours with more than one"), so nothing on screen can
 * make that choice and the widget has to make it. Without this the CTA sat on
 * "Check availability" forever - a question the widget had already answered -
 * because a departure was chosen everywhere except in the state.
 *
 * Counts DEPARTURES, not bookable ones, and so does the row's own
 * `slots.length > 1` gate - the two have to agree or they contradict each
 * other. A date with one open departure and one sold out shows the row (the
 * sold-out chip is worth saying: mck-15 §3 draws exactly that) and therefore
 * has a chip to click, so auto-picking would be choosing on the traveller's
 * behalf while a control sat right there. A lone SOLD-OUT departure picks
 * nothing either: there is nothing to pick.
 */
export function loneSlotTime(slots: BookingSlot[]): string | null {
    if (slots.length !== 1) return null;
    return slots[0].status === 'sold_out' ? null : slots[0].time;
}

export function createBookingStore(init: BookingInit) {
    const data = init.data ?? DUMMY_BOOKING_DATA;
    const locale = init.locale ?? 'en';

    const participantBands = data.bands.filter(b => b.kind === 'participant');
    const spectatorBands = data.bands.filter(b => b.kind === 'spectator');
    const hasSpectators = spectatorBands.length > 0;
    // Pattern A = a single participant band and no spectators (inline stepper).
    const isPatternB = participantBands.length > 1 || hasSpectators;
    const maxParty = data.maxPartySize ?? 99;

    const config: BookingConfig = {
        data,
        dict: init.dict,
        locale,
        tourId: init.tourId,
        destinationSlug: init.destinationSlug,
        tourSlug: init.tourSlug,
        currency: init.currency,
        initialDate: init.initialDate,
        participantBands,
        spectatorBands,
        hasSpectators,
        isPatternB,
        maxParty,
    };

    // Initial counts: the default participant band seeds the min party; everything
    // else starts at zero. (`buildTourBookingData` guarantees ≥1 participant band.)
    const initialCounts: Record<string, number> = {};
    data.bands.forEach(b => (initialCounts[b.id] = 0));
    const defaultBand =
        participantBands.find(b => b.isDefault) ?? participantBands[0];
    if (defaultBand) {
        initialCounts[defaultBand.id] = Math.max(1, data.minPartySize);
    }

    const initialState: BookingState = {
        counts: initialCounts,
        addOnQty: {},
        // Pre-chosen day from the URL, if any (see BookingInit.initialDate).
        selectedDate: parseLocalDateParam(init.initialDate),
        // The design/demo card has no backend to fetch departures from, so its
        // lone-slot auto-selection has to happen here; the live card does it in
        // `setDaySlots`, once the date's real departures land.
        selectedTime: init.tourId == null ? loneSlotTime(data.slots) : null,
        calendarOpen: false,
        partyOpen: false,
        // OPEN by default (mck-15 `S.details = true`, including its reset
        // state). The breakdown is the answer to "why that number", and a
        // traveller who has to ask for it has already been given a total they
        // cannot check. Collapsing is the deliberate act, not expanding.
        detailsOpen: true,
        spectatorsOn: false,
        travelerTouched: false,
        spectatorsApplied: false,
        policyModal: null,
        calendarDays: null,
        calendarLoading: false,
        calendarError: false,
        daySlots: null,
        slotsLoading: false,
        quote: null,
        quoteLoading: false,
        quoteError: false,
        ctaError: null,
        ctaErrorNonce: 0,
    };

    return createStore<BookingStore>()((set, get) => ({
        ...config,
        ...initialState,

        // The calendar covers the field stack while it is open, so the party
        // panel folds away with it - two panels cannot own the same space
        // (mck-15 opens one and closes the other on every field tap).
        setCalendarOpen: open =>
            set(open ? { calendarOpen: true, partyOpen: false } : { calendarOpen: false }),
        toggleCalendar: () =>
            set(s =>
                s.calendarOpen
                    ? { calendarOpen: false }
                    : { calendarOpen: true, partyOpen: false }
            ),
        togglePartyOpen: () =>
            set(s =>
                s.partyOpen
                    ? { partyOpen: false }
                    : { partyOpen: true, calendarOpen: false }
            ),
        toggleDetails: () => set(s => ({ detailsOpen: !s.detailsOpen })),
        setSpectatorsOn: on => set({ spectatorsOn: on }),
        setSpectatorsApplied: applied => set({ spectatorsApplied: applied }),
        setPolicyModal: kind => set({ policyModal: kind }),

        setBandCount: (band, next) => {
            const s = get();
            const clamped = Math.max(0, next);
            // Cap the whole party (travellers + spectators) at the effective max
            // (tour max, capped by the selected slot's remaining capacity).
            const current = s.counts[band.id] ?? 0;
            const others = travelerCountOf(s) - current;
            if (clamped > current && others + clamped > effectiveMaxOf(s)) {
                return;
            }
            set(prev => {
                const counts = { ...prev.counts, [band.id]: clamped };
                // Shrinking the party can drop a per-person extra below its own
                // ceiling, so re-clamp the extras against the new party rather
                // than leaving four open bars sold to two people.
                const next: Partial<BookingState> = {
                    // Changing the party reveals the spectators field.
                    travelerTouched:
                        band.kind === 'participant'
                            ? true
                            : prev.travelerTouched,
                    counts,
                };
                const paying = payingCountOf({ ...s, counts });
                let addOnQty: Record<string, number> | null = null;
                for (const addOn of s.data.addOns) {
                    const qty = prev.addOnQty[addOn.id] ?? 0;
                    const cap = addOnMaxOf(addOn, paying);
                    if (qty > cap) {
                        addOnQty ??= { ...prev.addOnQty };
                        addOnQty[addOn.id] = cap;
                    }
                }
                if (addOnQty) next.addOnQty = addOnQty;
                return next;
            });
        },

        setAddOnQty: (addOnId, next) => {
            const s = get();
            const addOn = s.data.addOns.find(a => a.id === addOnId);
            if (!addOn) return;
            // The same ceiling the backend enforces: per-person stops at the
            // paying travellers, per-booking stops at one, and the operator's
            // maxQuantity can only lower either.
            const clamped = Math.max(
                0,
                Math.min(next, addOnMaxOf(addOn, payingCountOf(s)))
            );
            set(prev => ({
                addOnQty: { ...prev.addOnQty, [addOnId]: clamped },
            }));
        },

        hydrateSelection: sel => {
            const s = get();

            // Party counts: only ids that exist on the CURRENT band set, whole
            // non-negative numbers, and only if the whole party still fits the
            // tour max - a stale/oversized snapshot keeps the defaults instead.
            let counts: Record<string, number> | null = null;
            if (sel.counts && typeof sel.counts === 'object') {
                const restored: Record<string, number> = {};
                s.data.bands.forEach(b => (restored[b.id] = 0));
                let seats = 0;
                let any = false;
                for (const band of s.data.bands) {
                    const n = sel.counts[band.id];
                    if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
                        restored[band.id] = Math.floor(n);
                        seats += restored[band.id];
                        any = true;
                    }
                }
                if (any && seats >= 1 && seats <= s.maxParty) {
                    counts = restored;
                }
            }

            // Extras: unknown add-on ids dropped, quantities re-clamped against
            // the CURRENT maxQuantity (the operator may have lowered it).
            const addOnQty: Record<string, number> = {};
            if (sel.addOnQty && typeof sel.addOnQty === 'object') {
                for (const addOn of s.data.addOns) {
                    const n = sel.addOnQty[addOn.id];
                    if (typeof n === 'number' && Number.isFinite(n) && n > 0) {
                        addOnQty[addOn.id] = Math.min(
                            Math.floor(n),
                            addOn.maxQuantity
                        );
                    }
                }
            }

            // Date: local YYYY-MM-DD, only if it is still today-or-future. The
            // availability sync refetches this date's slots automatically; the
            // persistence hook re-selects the time once the slots confirm it.
            // The URL date wins: arriving from a search for the 27th and being
            // silently put back on a date saved days ago is worse than losing
            // the saved one. Only fills in when the URL carried nothing.
            const selectedDate = get().initialDate
                ? null
                : parseLocalDateParam(sel.date);

            const restoredSpectators =
                counts != null &&
                s.spectatorBands.some(b => (counts[b.id] ?? 0) > 0);

            set(prev => ({
                ...(counts != null && {
                    counts,
                    travelerTouched: true,
                    ...(restoredSpectators && {
                        spectatorsOn: true,
                        spectatorsApplied: true,
                    }),
                }),
                addOnQty,
                ...(selectedDate != null && {
                    selectedDate,
                    // Mirror pickDate: drop stale slots and show loading (live
                    // mode) until the sync fetches this date's departures.
                    selectedTime: null,
                    daySlots: null,
                    slotsLoading: prev.tourId != null,
                }),
            }));
        },

        // Reset every spectator band to zero (the "No, not bringing spectators"
        // path). Left as a raw reset so it never trips the party-cap guard.
        clearSpectatorCounts: () =>
            set(prev => {
                const counts = { ...prev.counts };
                get().spectatorBands.forEach(b => (counts[b.id] = 0));
                return { counts };
            }),

        pickDate: date =>
            set(s => ({
                selectedDate: date,
                // Live: cleared until this date's departures land, where
                // `setDaySlots` re-picks a lone one. Demo: the static slots do
                // not change with the date, so keep the auto-picked one.
                selectedTime:
                    s.tourId != null ? null : loneSlotTime(s.data.slots),
                calendarOpen: false,
                ctaError: null,
                // Drop the previous date's slots and show loading (live only) until
                // the sync fetches this date's departures.
                daySlots: null,
                slotsLoading: s.tourId != null,
            })),

        selectTime: time =>
            set({
                selectedTime: time,
                ctaError: null,
            }),

        handleCtaClick: () => {
            const s = get();
            // An incomplete selection must never swallow the click (silent
            // no-op = "the button is broken"): say WHAT is missing above the
            // CTA and highlight that field, on top of the existing affordance
            // (missing date also pops the calendar open).
            if (!s.selectedDate) {
                set({
                    calendarOpen: true,
                    ctaError: 'date',
                    ctaErrorNonce: s.ctaErrorNonce + 1,
                });
                return;
            }
            if (s.selectedTime == null || travelerCountOf(s) < 1) {
                set({
                    ctaError: 'slot',
                    ctaErrorNonce: s.ctaErrorNonce + 1,
                });
                return;
            }
            // Party won't fit this slot: keep the selectors open (capped at
            // capacity) so the counts can be brought down to fit.
            if (
                s.selectedTime != null &&
                travelerCountOf(s) > effectiveMaxOf(s)
            ) {
                if (s.isPatternB) set({ partyOpen: true });
                return;
            }
            // Complete: nothing left for the card to do. The CTA hook takes it
            // to checkout; this only tidies the open panels behind it.
            set({
                partyOpen: false,
                calendarOpen: false,
                ctaError: null,
            });
        },

        setCalendarDays: (days, failed = false) =>
            set({
                calendarDays: days,
                calendarLoading: false,
                calendarError: failed,
            }),
        setCalendarLoading: loading => set({ calendarLoading: loading }),
        // A date with exactly one bookable departure picks it: no chip row is
        // rendered for it, so nothing on screen could (Pastel #58).
        setDaySlots: slots =>
            set(prev => ({
                daySlots: slots,
                slotsLoading: false,
                selectedTime: prev.selectedTime ?? loneSlotTime(slots),
            })),
        setSlotsLoading: loading => set({ slotsLoading: loading }),
        setQuote: quote =>
            set({ quote, quoteLoading: false, quoteError: false }),
        setQuoteLoading: loading => set({ quoteLoading: loading }),
        setQuoteError: error => set({ quoteError: error, quoteLoading: false }),
    }));
}

export type BookingStoreApi = ReturnType<typeof createBookingStore>;
