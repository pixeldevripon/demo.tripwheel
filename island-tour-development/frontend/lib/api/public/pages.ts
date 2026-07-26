/**
 * Published Pages (server-side, cached) - the WordPress-like permalink system
 * behind the legal/policy pages (`/{locale}/terms`, …).
 *
 * Hits `GET /pages/public/:slug`, which resolves one permalink three ways:
 *   - published page  -> content (English body when the locale has no
 *     translation, flagged `isEnglishFallback` so the page shows its notice)
 *   - renamed slug    -> `redirectToSlug` (the route issues the 301)
 *   - anything else   -> 404
 *
 * `publicGetStrict`, not `publicGet`: the `[destination]` route gates
 * `notFound()` on this answer, and a backend outage must abort the render (so
 * ISR keeps serving the last good page) rather than bake a 404 over a live
 * legal page.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { Locale } from '@/lib/constants/locales';

import { buildQuery, publicGetStrict } from './fetch';

export interface PublicPage {
    slug: string;
    /** The locale actually served - `en` when the requested one has no row. */
    locale: Locale;
    title: string;
    /**
     * Sanitized HTML (backend write-path sanitizer) - safe to render with
     * `dangerouslySetInnerHTML` as-is.
     */
    body: string;
    metaTitle: string | null;
    metaDescription: string | null;
    ogImage: string | null;
    isEnglishFallback: boolean;
    /** Set on a renamed permalink: 301 to this slug instead of rendering. */
    redirectToSlug: string | null;
}

/**
 * Resolve one published page by permalink. Null = genuinely not a page (the
 * caller may 404); a backend outage throws instead of returning null.
 *
 * Tagged with the coarse `pages` tag: a dashboard page save/publish/rename
 * busts every cached page entry. Coarse on purpose - there are a handful of
 * pages, and a rename needs the OLD slug's cached miss busted too, which a
 * per-slug tag could not do without the dashboard knowing both slugs.
 */
export async function getPublishedPage(
    slug: string,
    locale: Locale
): Promise<PublicPage | null> {
    'use cache';
    cacheLife('days');
    cacheTag('pages');

    return publicGetStrict<PublicPage>(
        `/pages/public/${encodeURIComponent(slug)}${buildQuery({ locale })}`
    );
}
