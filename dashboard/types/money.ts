/**
 * The backend's converted-price display object (backend `MoneyDto`, guide §20.9).
 * Returned on public tour cards/detail when `?currency` is passed. Amounts are the
 * already-converted values as strings; the frontend only formats them (never
 * computes FX). Neutral module - safe in both server and client bundles.
 */
import type { Currency } from '@/types/locale';

export interface Money {
    /** Currency the amounts are expressed in (target when converted, else source). */
    currency: Currency;
    /** The tour's own source currency (`defaultCurrency`). */
    sourceCurrency: Currency;
    /** Applied source -> currency rate as a string ("1" when same-currency / fallback). */
    fxRate: string;
    /** Converted "from" price (rounded 2dp), or null. */
    priceFrom: string | null;
    /** Converted base price (rounded 2dp), or null. */
    basePrice: string | null;
}
