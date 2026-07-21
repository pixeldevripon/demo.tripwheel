/**
 * Geo -> display-currency mapping (guide §21.1). Pure and isomorphic: the same
 * rule runs in the proxy (from the edge country header) and in the browser
 * (from the IANA time zone), so a visitor can never be quoted one currency by
 * the server and shown another by the footer pill.
 *
 * We sell in exactly two currencies, so the whole rule is one question: is this
 * visitor in Europe? Europe gets EUR, everywhere else gets USD - and that is
 * the right default for the Caribbean itself, where Curacao and Sint Maarten
 * quote in USD and Aruba's florin is dollar-pegged.
 *
 * Both helpers return `undefined` rather than a guess when the signal is
 * missing or unreadable, so the caller keeps the locale default instead of
 * flipping a shopper to USD on a header we could not parse. Geo NEVER overrides
 * a stored choice - it only fills the cookie when the visitor has none.
 */
import { type Currency } from '@/lib/constants/locales';

/**
 * The block where the euro is the familiar quote: EU 27 + EEA + UK + Switzerland
 * + the euro microstates + the Western Balkans + Moldova/Ukraine.
 *
 * Deliberately NOT geographic Europe. Turkey and Russia sit partly or wholly on
 * the continent but price international travel in dollars, so they fall through
 * to USD with the rest of the world.
 */
const EUR_COUNTRIES: ReadonlySet<string> = new Set([
    // EU 27
    'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
    'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
    'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
    // EEA / EFTA
    'CH', 'IS', 'LI', 'NO',
    // UK + crown dependencies
    'GB', 'GG', 'IM', 'JE',
    // Euro-using microstates and EU territories
    'AD', 'AX', 'FO', 'GI', 'MC', 'SM', 'VA',
    // Western Balkans + eastern neighbours
    'AL', 'BA', 'MD', 'ME', 'MK', 'RS', 'UA', 'XK',
]);

/**
 * Time zones outside the `Europe/` tree that still belong to a EUR country -
 * Spain's African enclaves, the Atlantic islands of Portugal/Spain/Iceland/the
 * Faroes, and Cyprus (filed under `Asia/`).
 */
const EUR_TIME_ZONES: ReadonlySet<string> = new Set([
    'Africa/Ceuta',
    'Asia/Famagusta',
    'Asia/Nicosia',
    'Atlantic/Azores',
    'Atlantic/Canary',
    'Atlantic/Faroe',
    'Atlantic/Madeira',
    'Atlantic/Reykjavik',
]);

/** Country headers we understand, most trusted first (Vercel, then Cloudflare). */
const COUNTRY_HEADERS = [
    'x-vercel-ip-country',
    'cf-ipcountry',
    'x-country',
] as const;

/**
 * The visitor's ISO 3166-1 alpha-2 country as reported by the edge, or
 * `undefined` when nothing upstream resolved one (local dev, a plain reverse
 * proxy, or Cloudflare's `XX` placeholder for an unknown address).
 */
export function countryFromHeaders(headers: Headers): string | undefined {
    for (const name of COUNTRY_HEADERS) {
        const value = headers.get(name)?.trim().toUpperCase();
        // 'XX' is Cloudflare's "could not determine"; 'T1' is a Tor exit node.
        if (value && value.length === 2 && value !== 'XX' && value !== 'T1') {
            return value;
        }
    }
    return undefined;
}

/** Display currency for an ISO country code. `undefined` when the code is unusable. */
export function currencyFromCountry(
    code?: string | null,
): Currency | undefined {
    const upper = code?.trim().toUpperCase();
    if (!upper || upper.length !== 2) return undefined;
    return EUR_COUNTRIES.has(upper) ? 'EUR' : 'USD';
}

/**
 * Display currency for an IANA time zone (`Europe/Amsterdam`, `America/New_York`).
 * A zone with no region prefix - bare `UTC`, or `GMT` on a locked-down browser -
 * tells us nothing about location, so it resolves to `undefined`.
 */
export function currencyFromTimeZone(
    zone?: string | null,
): Currency | undefined {
    if (!zone || !zone.includes('/')) return undefined;
    return zone.startsWith('Europe/') || EUR_TIME_ZONES.has(zone)
        ? 'EUR'
        : 'USD';
}

/**
 * The browser's own guess at the shopper's currency, from the clock's time zone.
 *
 * The time zone is the one location signal that costs nothing and asks for
 * nothing: no network round trip, no third-party IP lookup, and - unlike the
 * Geolocation API - no permission prompt and no personal data. It is coarser
 * than the edge's IP country, which is why the proxy's header wins whenever it
 * is available; this is the fallback for visitors who land straight on a
 * locale-prefixed URL, where the proxy never runs.
 *
 * Browser only. On the server this would report the datacenter's zone.
 */
export function detectBrowserCurrency(): Currency | undefined {
    try {
        return currencyFromTimeZone(
            Intl.DateTimeFormat().resolvedOptions().timeZone,
        );
    } catch {
        return undefined;
    }
}
