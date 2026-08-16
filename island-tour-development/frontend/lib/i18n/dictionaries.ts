import { cacheLife } from 'next/cache';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';

/**
 * Per-locale dictionary loaders. Each is a dynamic import so only the requested
 * locale's JSON is bundled into the server response - translation files never
 * reach the client bundle.
 *
 * Use only in Server Components / server code:
 *   const dict = await getDictionary(locale);
 */
const dictionaries = {
    en: () => import('./dictionaries/en.json').then((m) => m.default),
    es: () => import('./dictionaries/es.json').then((m) => m.default),
    nl: () => import('./dictionaries/nl.json').then((m) => m.default),
    pt: () => import('./dictionaries/pt.json').then((m) => m.default),
    fr: () => import('./dictionaries/fr.json').then((m) => m.default),
    de: () => import('./dictionaries/de.json').then((m) => m.default),
    zh: () => import('./dictionaries/zh.json').then((m) => m.default),
} as const;

/** Shape of a dictionary - inferred from the English (canonical) file. */
export type Dictionary = Awaited<ReturnType<(typeof dictionaries)['en']>>;

/**
 * BUMP THIS when you add or change a key in any `dictionaries/*.json`.
 *
 * The dynamic `import()` target below is not tracked as a `'use cache'`
 * dependency, so editing a dictionary JSON does not invalidate the cached entry
 * and the new key silently arrives as `undefined` in dev - which crashes the
 * first component that does `dict.someKey.replace(...)`, and reads as a bug in
 * that component rather than a stale cache.
 *
 * This used to be a comment saying "editing this file busts the entries". It
 * does not: the value is a cache ARGUMENT now, which is what `'use cache'`
 * actually keys on, so changing this string is guaranteed to bust every locale.
 * Any string works; the date + what was added is just a useful audit trail.
 */
const DICTIONARY_VERSION = '2026-08-16-checkout-operator-terms-gate';

export const getDictionary = (locale: Locale): Promise<Dictionary> =>
    loadDictionary(locale, DICTIONARY_VERSION);

async function loadDictionary(
    locale: Locale,
    // Part of the cache key ONLY - deliberately unread. See DICTIONARY_VERSION.
    _version: string,
): Promise<Dictionary> {
    'use cache';
    // Translation JSON is static per locale - cache indefinitely (locale +
    // version are the key). Keeps the dictionary out of the request-time
    // "uncached data" path so the layout/footer prerender without a Suspense
    // boundary (Cache Components).
    cacheLife('max');
    return (dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE])();
}
