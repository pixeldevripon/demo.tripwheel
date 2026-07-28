/**
 * Shared display helpers for the traveller account area.
 *
 * Money is always rendered in the ROW's own currency (never a global setting,
 * never a hardcoded symbol), and multi-currency totals are listed side by side
 * rather than summed - EUR and USD are not addable.
 */
import type { Currency, Locale } from '@/lib/constants/locales';
import { formatPriceFrom } from '@/lib/currency/current';

/** Narrow a backend currency string to the union the formatter accepts. */
export function toCurrency(value: string | null | undefined): Currency {
    return value === 'USD' ? 'USD' : 'EUR';
}

/** Format an exact decimal string in its own currency. */
export function money(
    amount: string | number,
    currency: string | null | undefined,
    locale: Locale
): string {
    return formatPriceFrom(amount, toCurrency(currency), locale);
}

/**
 * `en` renders booking dates day-first, matching `lib/thank-you/thank-you.ts`.
 * Without this remap the SAME booking would read "Jul 3, 2026" here and
 * "3 Jul 2026" on its thank-you page.
 */
const DATE_LOCALE: Partial<Record<Locale, string>> = { en: 'en-GB' };

/**
 * A wall-clock `localDate` (YYYY-MM-DD) or an ISO instant, as a readable date.
 * Date-only values are pinned to UTC so a negative-offset browser cannot show
 * the day before.
 */
export function formatDay(
    value: string | null | undefined,
    locale: Locale
): string {
    if (!value) return '';
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
}

/**
 * A label from a dictionary map, falling back to the raw key.
 *
 * The backend can introduce a status this build has no copy for; showing the
 * key is honest and debuggable, while an empty chip just looks broken.
 */
export function lookupLabel<T extends Record<string, string>>(
    dict: T,
    key: string
): string {
    return dict[key as keyof T] ?? key;
}

/** True when the amount parses to something greater than zero. */
export function isPositive(amount: string | null | undefined): boolean {
    const n = Number(amount);
    return Number.isFinite(n) && n > 0;
}
