'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useTransition } from 'react';

import {
    ALL_LOCALES,
    LOCALE_COOKIE,
    type Locale,
} from '@/lib/constants/locales';

/**
 * Shared locale-switch behaviour for the navbar and footer language selectors.
 * Switching swaps the first path segment, remembers the choice in the
 * NEXT_LOCALE cookie, and navigates inside a transition (content swaps in
 * place, no loading flash). `prefetchLocales` warms the other locale variants
 * of the current page - call it when the menu opens, so by the time the reader
 * picks a language the target route is already in the router cache and the
 * switch commits instantly instead of waiting a full server roundtrip.
 */
export function useLocaleSwitch(locale: Locale) {
    const pathname = usePathname();
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    const localePath = useCallback(
        (next: Locale) => {
            const segments = pathname.split('/');
            segments[1] = next; // [0] is '' (leading slash), [1] is the locale
            return segments.join('/') || `/${next}`;
        },
        [pathname]
    );

    const prefetchLocales = useCallback(() => {
        for (const code of ALL_LOCALES) {
            if (code !== locale) router.prefetch(localePath(code));
        }
    }, [locale, localePath, router]);

    const switchLocale = useCallback(
        (next: Locale) => {
            if (next === locale) return;
            // Secure on https, matching the server-side setter in proxy.ts.
            document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax${window.location.protocol === 'https:' ? ';secure' : ''}`;
            // scroll: false keeps the reader where they are.
            startTransition(() => {
                router.push(localePath(next), { scroll: false });
            });
        },
        [locale, localePath, router]
    );

    return { isPending, prefetchLocales, switchLocale };
}
