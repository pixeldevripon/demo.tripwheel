/**
 * Pure helpers shared by the booking widget (which builds the checkout URL) and
 * the checkout page (which parses it back and computes the summary). No
 * server/client-only imports - safe on both sides.
 *
 * The booking widget owns the live selection (date / time / party); it hands
 * that off to the checkout page through the query string so the page renders as
 * a fresh server navigation. Pickup, contact, and payment are chosen on the
 * checkout page itself.
 *
 * Pricing mirrors the widget exactly (same `TourBookingData`), so the totals a
 * traveller saw in the card carry through to checkout unchanged. Real
 * availability + a server-authoritative quote land with the booking module
 * (BOOKING-FLOW-DESIGN-GUIDE.md §9); until then this is client-derived.
 */
import type { ReserveItem } from '@/lib/api/bookings';
import type { BookingBand, TourBookingData } from '@/lib/tours/booking';

/**
 * Ids the widget synthesises when a tour has no real age bands (`default-adult`)
 * or is unit-priced (`unit-guests`). They are NOT real `ageBandId`s, so a
 * PER_PERSON quote/reserve can't be built from them.
 */
export const SYNTHETIC_BAND_IDS = new Set(['default-adult', 'unit-guests']);

/** The party selection in the shape the quote + reserve endpoints accept. */
export type BookingSelectionPayload =
    | { guests: number; items?: never }
    | { items: ReserveItem[]; guests?: never };

/**
 * Map the widget data + chosen counts to the party payload both `POST
 * /bookings/quote` and `POST /bookings` accept, or `null` when the selection
 * can't be sent server-side (empty, or synthetic-only bands with no real
 * `ageBandId`). UNIT tours send a single `guests` headcount; PER_PERSON sends one
 * `items` line per counted age band (spectators are age bands too). Shared so the
 * live quote and the checkout reserve always build the identical selection.
 */
export function buildBookingSelection(
    data: TourBookingData,
    counts: Record<string, number>
): BookingSelectionPayload | null {
    if (data.pricingModel === 'UNIT') {
        const guests = Object.values(counts).reduce((sum, n) => sum + n, 0);
        return guests > 0 ? { guests } : null;
    }
    const items = Object.entries(counts)
        .filter(([, quantity]) => quantity > 0)
        .map(([ageBandId, quantity]) => ({ ageBandId, quantity }));
    if (items.length === 0) return null;
    if (items.some((i) => SYNTHETIC_BAND_IDS.has(i.ageBandId))) return null;
    return { items };
}

/** The widget selection carried in the checkout URL. */
export interface CheckoutSelection {
    /** ISO calendar date `YYYY-MM-DD` (locale-free). */
    date: string | null;
    /** Wall-clock start time `HH:MM`. */
    time: string | null;
    /** Chosen count per band id (participants + spectators), zero rows omitted. */
    counts: Record<string, number>;
    /** Chosen quantity per add-on id (zero rows omitted). */
    addOns: Record<string, number>;
    /** Real departure id for the picked slot (live mode); reserve keys off it. */
    departureId: string | null;
    /** Server quote id snapshotted in the widget - submitted with the reserve. */
    quoteId: string | null;
    /** Shopper (booking) currency the widget quoted in; checkout re-prices in it. */
    currency: string | null;
}

/** A priced row in the checkout totals (band + chosen count). */
export interface CheckoutLineItem {
    band: BookingBand;
    count: number;
    lineTotal: number;
}

/** Money split for the commit block, mirroring the widget's price summary. */
export interface CheckoutTotals {
    lineItems: CheckoutLineItem[];
    /** Total travellers + spectators. */
    partySize: number;
    total: number;
    /** Amount charged today (deposit for deposit models, else the full total). */
    payToday: number;
    balanceLater: number;
    requiresDeposit: boolean;
}

/** Local `YYYY-MM-DD` for a Date (no timezone shift, unlike `toISOString`). */
export function toDateParam(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** Parse a `YYYY-MM-DD` param into a local Date, or null if malformed. */
export function fromDateParam(value: string | null): Date | null {
    if (!value) return null;
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return null;
    const date = new Date(y, m - 1, d);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Build the `?date=&time=&party=` query the widget appends to the checkout URL.
 * Party is encoded as `bandId:count` pairs (zero rows dropped) so the page can
 * rebuild the exact selection against the same band set.
 */
export function buildCheckoutQuery(selection: {
    date: string | null;
    time: string | null;
    counts: Record<string, number>;
    addOns?: Record<string, number>;
    departureId?: string | null;
    quoteId?: string | null;
    currency?: string | null;
}): string {
    const params = new URLSearchParams();
    if (selection.date) params.set('date', selection.date);
    if (selection.time) params.set('time', selection.time);
    const party = Object.entries(selection.counts)
        .filter(([, count]) => count > 0)
        .map(([id, count]) => `${id}:${count}`)
        .join(',');
    if (party) params.set('party', party);
    // Same `id:qty` encoding as the party pairs.
    const addons = Object.entries(selection.addOns ?? {})
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => `${id}:${qty}`)
        .join(',');
    if (addons) params.set('addons', addons);
    if (selection.departureId) params.set('departure', selection.departureId);
    if (selection.quoteId) params.set('quote', selection.quoteId);
    if (selection.currency) params.set('currency', selection.currency);
    return params.toString();
}

type RawSearchParams = Record<string, string | string[] | undefined>;

/** Read back the widget selection from the checkout page's search params. */
export function parseCheckoutSelection(
    searchParams: RawSearchParams
): CheckoutSelection {
    const first = (key: string): string | null => {
        const value = searchParams[key];
        const raw = Array.isArray(value) ? value[0] : value;
        return raw ?? null;
    };

    const parsePairs = (raw: string | null): Record<string, number> => {
        const out: Record<string, number> = {};
        if (!raw) return out;
        for (const pair of raw.split(',')) {
            const [id, rawCount] = pair.split(':');
            const count = Number(rawCount);
            if (id && Number.isFinite(count) && count > 0) out[id] = count;
        }
        return out;
    };

    return {
        date: first('date'),
        time: first('time'),
        counts: parsePairs(first('party')),
        addOns: parsePairs(first('addons')),
        departureId: first('departure'),
        quoteId: first('quote'),
        currency: first('currency'),
    };
}

/**
 * Compute the price split from the widget data + chosen counts. Falls back to a
 * sensible default party (the default band at the tour's minimum) when the URL
 * carries no valid selection, so a direct visit still renders a coherent summary.
 */
export function computeCheckoutTotals(
    data: TourBookingData,
    counts: Record<string, number>,
    extras?: {
        /** Chosen quantity per add-on id (from the widget, via the URL). */
        addOns?: Record<string, number>;
        /** Per-person price of the selected pickup zone (display currency). */
        pickupPrice?: number | null;
    }
): CheckoutTotals {
    // OPERATOR_FULL takes no money up front - the operator collects the whole
    // amount directly - so nothing is due today and the entire total rides the
    // balance. This mirrors `deriveBooking` in `lib/stores/booking-store.ts`,
    // which is the canonical split; the two must never disagree, because
    // whichever renders first is what the traveller reads as "pay now".
    //
    // Unreachable today (the widget disables booking for this model and the
    // backend rejects it at quote/reserve), but this is the third independent
    // implementation of the same money split - it has to agree by construction,
    // not by the accident of an upstream guard.
    const isOperatorFull = data.paymentModel === 'OPERATOR_FULL';

    const effective = { ...counts };
    const hasAny = Object.values(effective).some(n => n > 0);
    if (!hasAny) {
        const defaultBand =
            data.bands.find(b => b.kind === 'participant' && b.isDefault) ??
            data.bands.find(b => b.kind === 'participant');
        if (defaultBand) {
            effective[defaultBand.id] = Math.max(1, data.minPartySize);
        }
    }

    // Optional extras + priced pickup, mirroring the backend math: PER_PERSON
    // add-ons and pickup prices multiply by the party headcount; FLAT add-ons
    // charge their quantity once (master E.3 / 5.8).
    const extrasTotal = (partySize: number): number => {
        let sum = 0;
        for (const addOn of data.addOns) {
            const qty = extras?.addOns?.[addOn.id] ?? 0;
            if (qty <= 0) continue;
            const units = addOn.unit === 'PER_PERSON' ? qty * partySize : qty;
            sum += units * addOn.price;
        }
        if (extras?.pickupPrice != null && extras.pickupPrice > 0) {
            sum += extras.pickupPrice * partySize;
        }
        return Math.round(sum * 100) / 100;
    };

    // UNIT (whole-unit / charter): one guests count; total is basePrice plus a
    // per-guest surcharge beyond `unitIncludedGuests` (master §3.2), NOT a sum of
    // per-person bands. Mirrors the widget's `deriveBooking`.
    if (data.pricingModel === 'UNIT') {
        const guests =
            Object.values(effective).reduce((sum, n) => sum + n, 0) ||
            Math.max(1, data.minPartySize);
        const included = data.unitIncludedGuests ?? guests;
        const extra = Math.max(0, guests - included);
        const charterTotal = data.basePrice + extra * data.extraPersonPrice;
        const extrasValue = extrasTotal(guests);
        const total = charterTotal + extrasValue;
        const guestsBand = data.bands[0];
        const lineItems: CheckoutLineItem[] = guestsBand
            ? [{ band: guestsBand, count: guests, lineTotal: charterTotal }]
            : [];
        // Deposit % on the TOUR price only; extras ride the balance in full.
        const payToday = data.requiresDeposit
            ? Math.round(charterTotal * data.depositPct) / 100
            : isOperatorFull
              ? 0
              : total;
        return {
            lineItems,
            partySize: guests,
            total,
            payToday,
            balanceLater: total - payToday,
            requiresDeposit: data.requiresDeposit,
        };
    }

    const lineItems: CheckoutLineItem[] = data.bands
        .map(band => ({ band, count: effective[band.id] ?? 0 }))
        .filter(row => row.count > 0)
        .map(row => ({ ...row, lineTotal: row.count * row.band.price }));

    const partySize = lineItems.reduce((sum, row) => sum + row.count, 0);
    const tourTotal = lineItems.reduce((sum, row) => sum + row.lineTotal, 0);
    const extrasValue = extrasTotal(partySize);
    const total = tourTotal + extrasValue;
    // Deposit % on the TOUR price only; extras ride the balance in full.
    const payToday = data.requiresDeposit
        ? Math.round(tourTotal * data.depositPct) / 100
        : isOperatorFull
          ? 0
          : total;

    return {
        lineItems,
        partySize,
        total,
        payToday,
        balanceLater: total - payToday,
        requiresDeposit: data.requiresDeposit,
    };
}

/** Short band label without the age qualifier, e.g. "Adult (age 13+)" -> "Adult". */
export function shortBandLabel(band: BookingBand): string {
    return band.label.split(' (')[0];
}

/** Aggregated party line for the summary, e.g. "2 Adult, 1 Child". */
export function buildPartyLabel(lineItems: CheckoutLineItem[]): string {
    return lineItems
        .map(row => `${row.count} ${shortBandLabel(row.band)}`)
        .join(', ');
}

/**
 * `${symbol}${amount}` with locale grouping - matches the booking widget.
 * Exact prices: whole amounts stay bare ("$75"), fractional amounts always
 * carry both cents ("$63.75", never "$63.7" or a rounded "$64").
 */
export function formatCheckoutMoney(
    amount: number,
    symbol: string,
    locale: string
): string {
    return `${symbol}${amount.toLocaleString(locale, {
        minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
        maximumFractionDigits: 2,
    })}`;
}
