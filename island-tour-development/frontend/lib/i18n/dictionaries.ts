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

// Cache key bump: editing this file busts the 'use cache' entries in dev so newly
// added dictionary keys (e.g. `search`, `wishlist`, `allTours.emptyState`,
// `checkout.pickupSelect/pickupPricePP`, `booking.showExtras/addOnsTitle/
// perBookingShort/instantConfirmation*`) are picked up without a restart.
export const getDictionary = async (locale: Locale): Promise<Dictionary> => {
    'use cache';
    // Translation JSON is static per locale - cache indefinitely (locale is the key).
    // Keeps the dictionary out of the request-time "uncached data" path so the
    // layout/footer prerender without a Suspense boundary (Cache Components).
    //
    // Note: the dynamic import() target is not tracked as a cache dependency, so
    // editing a dictionary JSON file does NOT bust this entry in dev - restart the
    // dev server (or edit this file) to pick up new keys.
    cacheLife('max');
    return (dictionaries[locale] ?? dictionaries[DEFAULT_LOCALE])();
};
