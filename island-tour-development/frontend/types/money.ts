/**
 * The backend's converted-price display object (backend `MoneyDto`, guide §20.9).
 * Returned on public tour cards/detail when `?currency` is passed. Amounts are the
 * already-converted values as strings; the frontend only formats them (never
 * computes FX). Neutral module - safe in both server and client bundles.
 */
import type { Currency } from '@/lib/constants/locales';

export interface Money {
    /** Currency the amounts are expressed in (target when converted, else source). */
    currency: Currency;
    /** The tour's own source currency (`defaultCurrency`). */
    sourceCurrency: Currency;
    /** Applied source -> currency rate as a string ("1" when same-currency / fallback). */
    fxRate: string;
    /**
     * Converted "from" price, or null.
     *
     * A WHOLE currency unit, always rounded UP: the backend runs every
     * traveller-facing retail amount through `retailWhole` (ceil), so a $139
     * tour arrives as "128" rather than "127.88". Render it as served - do not
     * re-derive it from `fxRate`, and do not round it again.
     */
    priceFrom: string | null;
    /** Converted base price - whole unit, rounded up like `priceFrom`, or null. */
    basePrice: string | null;
}

/**
 * The `money` object on a tour DETAIL (backend `TourDetailMoneyDto`). Adds the
 * child retail amounts the booking widget prices from.
 *
 * The widget used to derive these itself by multiplying each source price by
 * `fxRate`, which disagreed with the backend twice over: it produced a different
 * headline number from the card's (127.88 against 128) and it kept cents on rows
 * the platform shows as whole units ("35,88 EUR" for a $39 add-on). Read these
 * instead - all whole units, already rounded up - and do no FX in the client.
 *
 * Maps are keyed by the child's id and OMIT children with no price of their own
 * (a free pickup zone, a zero-priced band), so a missing key means "no price
 * here", not "not converted".
 */
export interface TourDetailMoney extends Money {
    /** Per-extra-guest surcharge on GROUP unit tours; null otherwise. */
    extraPersonPrice: string | null;
    /** Age-band id -> its price. */
    ageBands: Record<string, string>;
    /** Add-on id -> its unit price. */
    addOns: Record<string, string>;
    /** Pickup-location id -> its per-person zone price (priced zones only). */
    pickupLocations: Record<string, string>;
}
