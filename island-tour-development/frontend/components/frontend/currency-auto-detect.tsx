'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { LOCALE_CURRENCY, type Locale } from '@/lib/constants/locales';
import { persistCurrency, storedCurrency } from '@/lib/currency/current';
import { detectBrowserCurrency } from '@/lib/currency/geo';

/**
 * Picks the shopper's currency from their location on the first visit, when
 * nothing else has.
 *
 * Renders nothing. It is the second of two chances to get the currency right,
 * and it only fires when the first missed:
 *
 *   1. `proxy.ts` sets the cookie from the edge country header on the locale
 *      redirect - covers anyone arriving at `/` or `/curacao`, before a single
 *      byte is rendered.
 *   2. this - covers deep landings straight onto `/en/curacao` (the proxy is
 *      matched out of those paths) and hosts that report no country header at
 *      all, reading the browser clock's time zone instead.
 *
 * A stored cookie always wins: an explicit pick in the footer selector, or an
 * earlier geo pick, must never be overwritten by a guess.
 *
 * MOUNT IT FIRST, above the navbar. The nav/hero search widgets, the wishlist,
 * and the footer pill all read the currency cookie in their own mount effects;
 * React runs a sibling subtree's effects in tree order, so writing the cookie
 * from the first sibling is what guarantees every one of them reads the
 * resolved value rather than the locale default.
 *
 * The `router.refresh()` re-runs the server components so the already-calculated
 * prices come back in the new currency - the cookie is what `getServerCurrency`
 * reads, so without the refresh the pill and the prices would disagree until the
 * next navigation. It happens once per visitor, ever, and only when geo actually
 * disagrees with the locale default.
 */
export function CurrencyAutoDetect({ locale }: { locale: Locale }) {
    const router = useRouter();

    useEffect(() => {
        if (storedCurrency(document.cookie)) return;

        const detected = detectBrowserCurrency();
        // No usable time zone - keep the locale default rather than guess.
        if (!detected) return;

        persistCurrency(detected);
        if (detected === (LOCALE_CURRENCY[locale] ?? 'EUR')) return;

        // Not wrapped in a transition on purpose: the visitor did not ask for
        // this, so it should not light up the selector's busy state.
        router.refresh();
    }, [locale, router]);

    return null;
}
