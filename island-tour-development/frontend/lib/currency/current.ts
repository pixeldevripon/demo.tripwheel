/**
 * Shopper display-currency helpers (guide §21.1). Isomorphic - safe in both the
 * server and client bundles (no `next/headers`). The server-only cookie reader
 * lives in `./server` so this module stays usable inside `'use client'` cards.
 *
 * The frontend NEVER computes FX rates. It only picks WHICH currency to display
 * and formats amounts the backend already converted (the `money` object, guide
 * §20.9). Authoritative money always comes from the server.
 */
import {
    CURRENCY_COOKIE,
    LOCALE_CURRENCY,
    isCurrency,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';

/**
 * The currency the visitor CHOSE, or `undefined` when they never picked one.
 * The distinction matters: "no cookie" is what lets the locale default apply,
 * so this must NOT fold in a default. Callers that just want a currency to
 * render with should use `currencyFromCookie`.
 */
export function storedCurrency(
    cookieHeader?: string | null,
): Currency | undefined {
    const raw = cookieHeader
        ? cookieHeader
              .split(';')
              .map((c) => c.trim())
              .find((c) => c.startsWith(`${CURRENCY_COOKIE}=`))
              ?.slice(CURRENCY_COOKIE.length + 1)
        : undefined;
    const value = raw ? decodeURIComponent(raw) : undefined;
    return isCurrency(value) ? value : undefined;
}

/**
 * Resolve the shopper's display currency from a raw `Cookie` header string. Falls
 * back to the locale's default currency (EN/ZH -> USD, the rest EUR), then EUR.
 * Pure + testable: pass `document.cookie` on the client or the request cookie header
 * on the server (or use `getServerCurrency` which reads `cookies()` for you).
 */
export function currencyFromCookie(
    cookieHeader?: string | null,
    locale?: Locale,
): Currency {
    return (
        storedCurrency(cookieHeader) ??
        (locale && LOCALE_CURRENCY[locale]) ??
        'EUR'
    );
}

/**
 * Persist the shopper's display currency for a year. The footer selector is the
 * only caller, so a set cookie always means "this visitor chose this" - which is
 * what lets it outrank the locale default without ambiguity.
 *
 * Deliberately readable by JS: `getServerCurrency` reads it server-side, but the
 * navbar/hero search widgets and the footer pill read it from `document.cookie`.
 */
export function persistCurrency(next: Currency): void {
    document.cookie = `${CURRENCY_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
}

/**
 * Always print the bare symbol - `$1,750`, never `US$ 1.750`.
 *
 * Left to itself, `Intl` disambiguates the dollar in every locale that has its
 * own: pt/nl render USD as `US$`, fr as `$US`, es as `US$`, zh as `US$`. On a
 * Caribbean tour card that disambiguation is noise - there is only one dollar in
 * play, the shopper picked it, and the prefix reads like part of the number.
 * `narrowSymbol` collapses all of them to `$` and leaves `€` untouched.
 */
const CURRENCY_DISPLAY = 'narrowSymbol' as const;

/**
 * Format an already-converted amount as localized currency (guide §21.1). Use for
 * concrete totals (checkout, TYP, deposit/balance) where cents matter.
 * `formatMoney('120.00', 'EUR', 'de')` -> "120,00 €".
 */
export function formatMoney(
    amount: string | number,
    currency: Currency,
    locale: Locale,
): string {
    const n = Number(amount);
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: CURRENCY_DISPLAY,
    }).format(Number.isFinite(n) ? n : 0);
}

/**
 * Format a listing "From" price EXACTLY as priced (founder rule 2026-07-16: never
 * round money for display). Whole amounts stay bare ("$120"); fractional amounts
 * carry both cents ("$63.75"). `formatPriceFrom(120, 'USD', 'en')` -> "$120".
 */
export function formatPriceFrom(
    amount: string | number,
    currency: Currency,
    locale: Locale,
): string {
    const raw = Number(amount);
    const n = Number.isFinite(raw) ? Math.round(raw * 100) / 100 : 0;
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        currencyDisplay: CURRENCY_DISPLAY,
        minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
        maximumFractionDigits: 2,
    }).format(n);
}

/** A card/detail shape that may carry the backend's converted `money` object. */
export interface DisplayPriceInput {
    money?: {
        currency: Currency;
        fxRate?: string;
        priceFrom: string | null;
    } | null;
    priceFrom?: number | string | null;
    basePrice?: number | string | null;
    /** The tour's own source currency (cards call it `defaultCurrency`, picks `currency`). */
    defaultCurrency?: string | null;
    currency?: string | null;
}

/**
 * The single source of truth for a listing "From" price + currency (guide §20.9).
 * Prefers the backend's converted `money`; falls back to the tour's own source
 * price/currency, then `fallbackCurrency` (the shopper currency), then EUR.
 * Reused by every card surface (main listing mappers, hub cards/picks/comparison)
 * so the resolution rule lives in exactly one place.
 */
export function resolveDisplayPrice(
    tour: DisplayPriceInput,
    locale: Locale,
    fallbackCurrency: Currency = 'EUR',
): { price: number; currency: Currency; priceDisplay: string; fxRate: number } {
    const raw = tour.money?.currency ?? tour.defaultCurrency ?? tour.currency;
    const currency: Currency = isCurrency(raw) ? raw : fallbackCurrency;
    const value = Number(
        tour.money?.priceFrom ?? tour.priceFrom ?? tour.basePrice ?? 0,
    );
    // Cents precision - the card must show the exact backend price, never a
    // whole-unit rounding of it.
    const price = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
    const fxRate = Number(tour.money?.fxRate ?? 1) || 1;
    return {
        price,
        currency,
        fxRate,
        priceDisplay: formatPriceFrom(price, currency, locale),
    };
}

/**
 * Derive the shopper display currency + rate from a set of converted tours (all
 * share the shopper currency and a common source, so one rate applies). Use it to
 * convert backend SOURCE-currency aggregates the backend does not convert - the
 * hub hero and collection "from" fast-stats (guide §20.9 defers those). Falls back
 * to `fallbackCurrency` at rate 1 when nothing in the set carries `money`.
 */
export function deriveDisplayRate(
    tours: Array<{
        money?: { currency: Currency; fxRate?: string } | null;
    }>,
    fallbackCurrency: Currency,
): { currency: Currency; rate: number; converted: boolean } {
    const m = tours.find((t) => t.money)?.money;
    return {
        currency: isCurrency(m?.currency) ? m.currency : fallbackCurrency,
        rate: Number(m?.fxRate ?? 1) || 1,
        // `converted: false` means NO tour in the set carried a `money` object,
        // so the returned rate is the identity and the currency is only the
        // shopper's default. A caller converting a SOURCE-currency aggregate
        // must drop the figure rather than print it: rate 1 under the shopper's
        // symbol turns "$120" into "€120", which is not a rounding error, it is
        // a different price. A missing pill is strictly better than a wrong one.
        converted: m != null,
    };
}
