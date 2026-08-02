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

/**
 * Metadata for a URL that does not resolve to anything.
 *
 * NO canonical, NO hreflang — deliberately. `generateMetadata` runs before the
 * page's `notFound()`, and under `cacheComponents` the prerendered shell has
 * already flushed by then, so the response is a 200 regardless. Emitting
 * `alternates` on that branch handed a crawler the strongest possible "this is
 * a real, indexable page" signal — a self-referencing canonical plus a declared
 * seven-language cluster — for a URL that is a 404.
 *
 * The concrete abuse: anyone can link from their own site to
 * `/{locale}/{spam-phrase}/tours`, and every one of those URLs answered 200
 * with a canonical pointing at itself. That is a doorway-page generator on our
 * own domain, costing the attacker nothing.
 *
 * `follow: true` so any real links on the 404 screen still pass through; it is
 * indexing we are refusing, not crawling.
 */
export const NOT_FOUND_METADATA = {
    robots: { index: false, follow: true },
} as const;
