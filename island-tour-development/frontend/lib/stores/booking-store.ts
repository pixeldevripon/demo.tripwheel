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
import type { Currency } from '@/lib/constants/locales';
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

/** Per-day availability for the month calendar (from `/availability/calendar`). */
export interface CalendarDayState {
    available: boolean;
    status: string;
    remaining: number | null;
}

/** A single band row for the price breakdown (band + its chosen count). */
export type BookingLineItem = { band: BookingBand; count: number };

/**
 * A rendered price-breakdown row: `text` is the full left-hand label (e.g.
 * "Adult x 2 x $120" or "Charter (up to 10 guests)"), `amount` the right-hand
 * money value. Both pricing models produce these so the summary renders one way.
 */
export type PriceRow = { id: string; text: string; amount: number };

/**
 * The payment trust line rendered under free-cancellation. `modal` (deposit
 * models) carries a clickable `{link}` phrase that opens the deposit modal;
 * `plain` (paid_in_full) is a static statement; `null` (operator_full) renders
 * no payment line.
 */
export type PaymentTrust =
    | { kind: 'modal'; before: string; link: string; after: string }
    | { kind: 'plain'; text: string }
    | null;

/** Static, per-tour configuration derived once when the store is created. */
export interface BookingConfig {
    data: TourBookingData;
    dict: TourBookingDict;
    locale: string;
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
    selectedDate: Date | null;
    selectedTime: string | null;
    calendarOpen: boolean;
    partyOpen: boolean;
    detailsOpen: boolean;
    spectatorsOn: boolean;
    /** The spectators field only surfaces once the traveller count is touched. */
    travelerTouched: boolean;
    spectatorsApplied: boolean;
    availabilityChecked: boolean;
    policyModal: PolicyModalKind;
    /** Month-calendar availability keyed by `yyyy-MM-dd`; null until first load
     *  (live mode only - stays null in demo/design mode). */
    calendarDays: Record<string, CalendarDayState> | null;
    calendarLoading: boolean;
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
    clearSpectatorCounts: () => void;
    pickDate: (date: Date) => void;
    selectTime: (time: string) => void;
    handleCtaClick: () => void;
    /** Set by the availability sync once the calendar range resolves. */
    setCalendarDays: (days: Record<string, CalendarDayState>) => void;
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
    locale?: string;
    tourId?: string;
    destinationSlug?: string;
    tourSlug?: string;
    currency?: Currency;
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

    // Readiness (price summary shown, CTA = the reserve action). In LIVE mode the
    // backend already pre-verified availability (the calendar only offers open
    // days and `/availability/check` only returns bookable slots), so a complete,
    // in-capacity selection is immediately ready - there is nothing left to
    // "check", and the party stays editable after ready (steppers remain). The
    // design/demo card (no tour id) keeps the explicit two-phase check click.
    const selectionComplete =
        s.selectedDate != null &&
        s.selectedTime != null &&
        travelerCount >= 1 &&
        !overCapacity;
    const ready = isLive ? selectionComplete : s.availabilityChecked;
    const editingParty = isLive ? true : !s.availabilityChecked;

    const cur = s.data.currencySymbol;
    // Exact prices: whole amounts stay bare ("$75"), fractional amounts always
    // carry both cents ("$63.75", never "$63.7" or a rounded "$64").
    const money = (n: number) =>
        `${cur}${n.toLocaleString(s.locale, {
            minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
            maximumFractionDigits: 2,
        })}`;

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
                text: `${s.dict.unitExtraGuests} x ${extra} x ${money(
                    s.data.extraPersonPrice
                )}`,
                amount: extra * s.data.extraPersonPrice,
            });
        }
        total = s.data.basePrice + extra * s.data.extraPersonPrice;
    } else {
        priceRows = s.data.bands
            .map(b => ({ band: b, count: s.counts[b.id] ?? 0 }))
            .filter(row => row.count > 0)
            .map(({ band, count }) => ({
                id: band.id,
                text: `${
                    band.kind === 'spectator' ? s.dict.spectators : band.label
                } x ${count} x ${money(band.price)}`,
                amount: count * band.price,
            }));
        total = priceRows.reduce((sum, r) => sum + r.amount, 0);
    }

    // ── Payment-model conditional (master §3.1 / §5.8 / §6.1) ────────────────
    // The card's money rows, CTA label, and trust lines are all driven by the
    // tour's real `paymentModel` + `depositPct`.
    const paymentModel = s.data.paymentModel;
    const isDepositModel =
        paymentModel === 'OPERATOR_LINK' || paymentModel === 'ON_ARRIVAL';
    const isFullModel = paymentModel === 'PAID_IN_FULL';
    const isOperatorFull = paymentModel === 'OPERATOR_FULL';
    // operator_full is dropped in v1 (founder decision, SETTLEMENT-AND-PAYOUTS):
    // the widget must never offer a payment-free reserve. A tour still carrying
    // it is not bookable here.
    const bookingBlocked = isOperatorFull;

    const usesDeposit =
        isDepositModel && s.data.depositPct > 0 && s.data.depositPct < 100;
    // Deposit estimate rounds to cents, not whole units (the quote's 2dp amounts
    // replace it below; the optimistic value must not visibly jump).
    let payToday = usesDeposit
        ? Math.round(total * s.data.depositPct) / 100
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
        // Rebuild the breakdown from the quote lines so it reconciles to the total.
        priceRows = q.lines.map((l, i) => ({
            id: `${l.kind}-${l.ageBandId ?? i}`,
            text: `${l.label} x ${l.quantity} x ${money(Number(l.unitPrice))}`,
            amount: Number(l.lineTotal),
        }));
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

    // Payment trust line (below free-cancellation), model-specific:
    //  - deposit models: clickable "{link}, the rest via the operator's secure
    //    link" / "... on arrival" opening the deposit modal;
    //  - paid_in_full: a plain "Pay in full now" statement (no modal);
    //  - operator_full: none.
    const paymentTrust: PaymentTrust = isDepositModel
        ? (() => {
              const template =
                  paymentModel === 'ON_ARRIVAL'
                      ? s.dict.payOnArrival
                      : s.dict.payLater;
              const [before, after] = fillPolicy(template).split('{link}');
              return {
                  kind: 'modal',
                  before,
                  link: fillPolicy(s.dict.payLaterLink),
                  after,
              };
          })()
        : isFullModel
          ? { kind: 'plain', text: fillPolicy(s.dict.payInFull) }
          : null;

    const bandPriceLabel = (band: BookingBand): string =>
        band.price > 0
            ? `${money(band.price)}${s.dict.perPersonShort}`
            : s.dict.free;

    const partyMin = (band: BookingBand) => partyMinOf(s, band);

    // While editing: Pattern A gets an inline header stepper, Pattern B gets a
    // chevron that expands its age-band steppers. Once the availability check
    // passes the header control disappears and the price summary takes over.
    const headerHasChevron = s.isPatternB && editingParty;
    const showInlineStepper = !s.isPatternB && editingParty;
    const showPartyBody = s.isPatternB && s.partyOpen && editingParty;

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
        // Server-authoritative quote for the current selection + its load state
        // (the summary can show a subtle refresh; the CTA carries `quote.quoteId`
        // to checkout). `usingQuote` is true when the summary reflects the quote.
        quote: s.quote,
        quoteLoading: s.quoteLoading,
        usingQuote: useQuote,
    };
}

/* ─── Store factory ──────────────────────────────────────────────────────── */

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
        selectedDate: null,
        selectedTime: null,
        calendarOpen: false,
        partyOpen: false,
        detailsOpen: false,
        spectatorsOn: false,
        travelerTouched: false,
        spectatorsApplied: false,
        availabilityChecked: false,
        policyModal: null,
        calendarDays: null,
        calendarLoading: false,
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

        setCalendarOpen: open => set({ calendarOpen: open }),
        toggleCalendar: () => set(s => ({ calendarOpen: !s.calendarOpen })),
        togglePartyOpen: () => set(s => ({ partyOpen: !s.partyOpen })),
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
            set(prev => ({
                // Changing the party reveals the spectators field and forces a
                // re-check.
                travelerTouched:
                    band.kind === 'participant' ? true : prev.travelerTouched,
                availabilityChecked: false,
                counts: { ...prev.counts, [band.id]: clamped },
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
                selectedTime: null,
                availabilityChecked: false,
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
                availabilityChecked: false,
                ctaError: null,
            }),

        handleCtaClick: () => {
            const s = get();
            if (s.availabilityChecked) return; // Continue -> checkout (booking module).
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
            set({
                partyOpen: false,
                calendarOpen: false,
                availabilityChecked: true,
                ctaError: null,
            });
        },

        setCalendarDays: days =>
            set({ calendarDays: days, calendarLoading: false }),
        setCalendarLoading: loading => set({ calendarLoading: loading }),
        setDaySlots: slots => set({ daySlots: slots, slotsLoading: false }),
        setSlotsLoading: loading => set({ slotsLoading: loading }),
        setQuote: quote =>
            set({ quote, quoteLoading: false, quoteError: false }),
        setQuoteLoading: loading => set({ quoteLoading: loading }),
        setQuoteError: error => set({ quoteError: error, quoteLoading: false }),
    }));
}

export type BookingStoreApi = ReturnType<typeof createBookingStore>;
