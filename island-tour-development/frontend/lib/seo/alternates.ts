import { ALL_LOCALES, DEFAULT_LOCALE, type Locale } from '@/lib/constants/locales';

/**
 * Canonical + hreflang for a public page (ROUTING-AND-RESOLUTION.md §11.2).
 *
 * Slugs are identical in every locale - only the prefix changes - so a page
 * emits an alternate for all 7 locales plus `x-default -> English`, and its own
 * per-locale URL as the canonical.
 *
 * `path` is the locale-LESS path with a leading slash (`/curacao/tours`). Pass
 * it without a query string: the canonical must be self-referencing to the base
 * page so filtered views (`?sort=`, `?date=`, `?adults=`) consolidate into one
 * indexable URL instead of one per filter combination (§11.3). Next resolves
 * these against the root layout's `metadataBase`.
 */
export function buildAlternates(locale: Locale, path: string) {
    const languages: Record<string, string> = {};
    for (const loc of ALL_LOCALES) languages[loc] = `/${loc}${path}`;
    languages['x-default'] = `/${DEFAULT_LOCALE}${path}`;

    return { canonical: `/${locale}${path}`, languages };
}
