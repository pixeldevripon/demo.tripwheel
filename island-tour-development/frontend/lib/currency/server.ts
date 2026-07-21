import 'server-only';

import { cookies } from 'next/headers';

import {
    CURRENCY_COOKIE,
    LOCALE_CURRENCY,
    isCurrency,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';

/**
 * The shopper's display currency, read server-side from the `NEXT_CURRENCY` cookie
 * (guide §21.1/§21.5). Falls back to the locale's default currency, then EUR. Call
 * this in a server component / page, then thread the result into the currency-aware
 * public API clients and into the booking widget.
 *
 * The cookie is the ONLY signal here. Geo never enters this function: it only ever
 * writes that cookie (in `proxy.ts` from the edge country header, or in
 * `CurrencyAutoDetect` from the browser time zone), so prices keep resolving
 * through exactly one input.
 *
 * Reading `cookies()` opts the caller into dynamic rendering - do it inside a
 * Suspense-streamed section so the static shell still prerenders (see the PPR
 * rendering policy).
 */
export async function getServerCurrency(locale?: Locale): Promise<Currency> {
    const value = (await cookies()).get(CURRENCY_COOKIE)?.value;
    if (isCurrency(value)) return value;
    return (locale && LOCALE_CURRENCY[locale]) ?? 'EUR';
}
