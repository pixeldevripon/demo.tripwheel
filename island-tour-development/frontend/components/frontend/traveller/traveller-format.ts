/**
 * Shared display helpers for the traveller account area.
 *
 * Money is always rendered in the ROW's own currency (never a global setting,
 * never a hardcoded symbol), and multi-currency totals are listed side by side
 * rather than summed - EUR and USD are not addable.
 */
import type { Currency, Locale } from '@/lib/constants/locales';
import { formatMoney } from '@/lib/currency/current';

/** Narrow a backend currency string to the union the formatter accepts. */
export function toCurrency(value: string | null | undefined): Currency {
    return value === 'USD' ? 'USD' : 'EUR';
}

/**
 * Format an exact decimal string in its own currency.
 *
 * `formatMoney`, NOT `formatPriceFrom`. The two differ on whole amounts:
 * `formatPriceFrom` is the LISTING "From" price and renders 1750 bare as
 * "$1,750", while `formatMoney` is the concrete-total formatter and always
 * carries cents. This helper feeds booking cards, the next-trip hero, the
 * payments ledger and the printable receipt - concrete totals, every one.
 *
 * Using the listing rule here made the account area disagree with the thank-you
 * page one click away, which is the exact bug already documented in
 * `thank-you-summary.tsx`: "a 1750 total rendered as $1750 ... while every other
 * surface showed $1,750.00". A receipt that silently drops cents is worse still.
 */
export function money(
    amount: string | number,
    currency: string | null | undefined,
    locale: Locale
): string {
    return formatMoney(amount, toCurrency(currency), locale);
}

/**
 * `en` renders booking dates day-first, matching `lib/thank-you/thank-you.ts`.
 * Without this remap the SAME booking would read "Jul 3, 2026" here and
 * "3 Jul 2026" on its thank-you page.
 */
const DATE_LOCALE: Partial<Record<Locale, string>> = { en: 'en-GB' };

function parseWallClock(value: string | null | undefined): Date | null {
    if (!value) return null;
    const iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value;
    const date = new Date(iso);
    return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A wall-clock `localDate` (YYYY-MM-DD) or an ISO instant, as a readable date.
 * Date-only values are pinned to UTC so a negative-offset browser cannot show
 * the day before. Carries the weekday (review F16): "Fri 14 Aug 2026".
 */
export function formatDay(
    value: string | null | undefined,
    locale: Locale
): string {
    const date = parseWallClock(value);
    if (!date) return '';
    return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
    }).format(date);
}

/**
 * A money deadline: "{Day, DD Mon, HH:MM}" (review F10). The value is the
 * backend's LOCAL wall clock serialized as a UTC-labeled ISO string, so it is
 * read back in UTC - the island's clock, not the browser's.
 */
export function formatDeadline(
    value: string | null | undefined,
    locale: Locale
): string {
    const date = parseWallClock(value);
    if (!date) return '';
    const day = new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(date);
    const time = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
        timeZone: 'UTC',
    }).format(date);
    return `${day}, ${time}`;
}

/** "Fri 14 Aug" - the short trip date inside the cancel confirm strip. */
export function formatDayShort(
    value: string | null | undefined,
    locale: Locale
): string {
    const date = parseWallClock(value);
    if (!date) return '';
    return new Intl.DateTimeFormat(DATE_LOCALE[locale] ?? locale, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'UTC',
    }).format(date);
}

/** "{count} traveler(s)" with a real singular (review F8). */
export function partyLabel(
    count: number,
    dict: { guestsOne: string; guests: string }
): string {
    return count === 1
        ? dict.guestsOne
        : dict.guests.replace('{count}', String(count));
}

/** Rough duration label from the tour's lower-bound minutes: "8h" / "2h 30m". */
export function durationLabel(minutes: number | null | undefined): string {
    if (!minutes || minutes <= 0) return '';
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * "d•••••e@gmail.com" for the signed-in row - the raw address never renders
 * on a surface that gets screenshotted and shared.
 */
export function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain || !local) return email;
    const first = local[0] ?? '';
    const last = local.length > 1 ? local[local.length - 1] : '';
    return `${first}•••••${last}@${domain}`;
}

/** Google Maps link, coordinates first (an address is ambiguous across islands). */
export function mapsUrl(
    lat: number | null,
    lng: number | null,
    address: string | null
): string | null {
    const query =
        lat != null && lng != null ? `${lat},${lng}` : (address ?? '').trim();
    if (!query) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

function capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * How a payment method is displayed: "Visa ·· 4242", or the bare method type
 * when there is no card behind it.
 *
 * ONE definition on purpose. The receipt and the payments ledger used to build
 * this separately and had already drifted: with a brand but no last4 the
 * receipt rendered "Visa ··" (its `.trim()` stripped the trailing space but not
 * the separator) while the ledger correctly rendered "Visa". The receipt is
 * linked straight off a ledger row, so a traveller sees both spellings of the
 * same payment.
 */
export function paymentMethodLabel(
    brand: string | null | undefined,
    last4: string | null | undefined,
    type: string | null | undefined
): string | null {
    if (brand) {
        return last4 ? `${capitalize(brand)} ·· ${last4}` : capitalize(brand);
    }
    return type ? capitalize(type) : null;
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
