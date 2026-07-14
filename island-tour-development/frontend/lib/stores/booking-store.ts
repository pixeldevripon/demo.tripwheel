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

import {
    DUMMY_BOOKING_DATA,
    type BookingBand,
    type TourBookingData,
    type TourBookingDict,
} from '@/lib/tours/booking';
import { createStore } from 'zustand';

/** Which policy modal (if any) is open, opened from the trust lines. */
export type PolicyModalKind = null | 'cancellation' | 'deposit';

/** A single band row for the price breakdown (band + its chosen count). */
export type BookingLineItem = { band: BookingBand; count: number };

/** Static, per-tour configuration derived once when the store is created. */
export interface BookingConfig {
    data: TourBookingData;
    dict: TourBookingDict;
    locale: string;
    /** Destination + tour slug for the checkout URL on Continue (optional: the
     *  card still works in isolation, e.g. design/demo, when they're absent). */
    destinationSlug?: string;
    tourSlug?: string;
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
}

export type BookingStore = BookingConfig & BookingState & BookingActions;

/** Props used to seed a fresh store (falls back to the design/demo dataset). */
export interface BookingInit {
    dict: TourBookingDict;
    data?: TourBookingData;
    locale?: string;
    destinationSlug?: string;
    tourSlug?: string;
}

/* ─── Pure derivations (from a full store snapshot) ───────────────────────── */

function travelerCountOf(s: BookingConfig & BookingState): number {
    return s.data.bands.reduce((n, b) => n + (s.counts[b.id] ?? 0), 0);
}

// Largest party allowed right now: the tour max, further capped by the slot's
// remaining capacity (null remaining = ample room, so only the tour max applies).
function effectiveMaxOf(s: BookingConfig & BookingState): number {
    if (s.selectedTime == null) return s.maxParty;
    const slot = s.data.slots.find(x => x.time === s.selectedTime) ?? null;
    const slotCapacity = slot?.remaining ?? s.maxParty;
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

    // `ready` (summary shown, CTA = "Continue") is gated on the availability
    // check; selectors stay editable until it passes.
    const ready = s.availabilityChecked;
    const editingParty = !s.availabilityChecked;

    const lineItems: BookingLineItem[] = s.data.bands
        .map(b => ({ band: b, count: s.counts[b.id] ?? 0 }))
        .filter(row => row.count > 0);
    const total = lineItems.reduce(
        (sum, row) => sum + row.count * row.band.price,
        0
    );
    const payToday = s.data.requiresDeposit
        ? Math.round((total * s.data.depositPct) / 100)
        : total;
    const balanceLater = total - payToday;

    const cur = s.data.currencySymbol;
    const money = (n: number) => `${cur}${n.toLocaleString(s.locale)}`;

    // Interpolate policy-copy placeholders from the live tour data.
    const fillPolicy = (str: string) =>
        str
            .replace(/\{hours\}/g, String(s.data.cancellationHours))
            .replace(/\{pct\}/g, String(s.data.depositPct));

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
        ready,
        editingParty,
        lineItems,
        total,
        payToday,
        balanceLater,
        money,
        fillPolicy,
        bandPriceLabel,
        partyMin,
        headerHasChevron,
        showInlineStepper,
        showPartyBody,
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
        destinationSlug: init.destinationSlug,
        tourSlug: init.tourSlug,
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
            set({
                selectedDate: date,
                selectedTime: null,
                availabilityChecked: false,
                calendarOpen: false,
            }),

        selectTime: time =>
            set({ selectedTime: time, availabilityChecked: false }),

        handleCtaClick: () => {
            const s = get();
            if (s.availabilityChecked) return; // Continue -> checkout (booking module).
            if (!s.selectedDate) {
                set({ calendarOpen: true });
                return;
            }
            if (s.selectedTime == null || travelerCountOf(s) < 1) return;
            // Party won't fit this slot: keep the selectors open (capped at
            // capacity) so the counts can be brought down to fit.
            if (s.selectedTime != null && travelerCountOf(s) > effectiveMaxOf(s)) {
                if (s.isPatternB) set({ partyOpen: true });
                return;
            }
            set({
                partyOpen: false,
                calendarOpen: false,
                availabilityChecked: true,
            });
        },
    }));
}

export type BookingStoreApi = ReturnType<typeof createBookingStore>;
