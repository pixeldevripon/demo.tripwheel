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
 * (guide §21.1/§21.5). Falls back to the locale's default currency. Call this in a
 * server component / page, then thread the result into the currency-aware
 * public API clients and into the booking widget.
 *
 * The cookie is the ONLY signal here, and it now carries exactly one meaning:
 * this visitor picked that currency in the footer. Nothing infers currency from
 * the device or the IP - master 1.3 locks the default to the LOCALE and files
 * IP-based localization under roadmap.
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
