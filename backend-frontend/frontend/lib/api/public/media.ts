/**
 * Public media SEO data (server-side, cached). Backs the "exclude this
 * attachment from indexing" flag set in the dashboard media library: any
 * image URL on this list must be left out of everything the platform
 * publishes for search engines - og:image, structured data, image sitemaps.
 * It does NOT hide the image on the page itself.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { publicGet } from './fetch';

/**
 * Compare ignoring query strings (Cloudinary appends analytics params).
 *
 * Exported because it is the KEY FORMAT of the `getMediaSeo` map, not just an
 * internal detail: a caller holding a raw entity URL has to normalize it the
 * same way to find its row.
 */
export function normalizeUrl(url: string): string {
    return url.split('?')[0];
}

/**
 * Platform-wide list of media URLs flagged excludeFromIndexing. Cached hourly
 * so dashboard toggles propagate without a cross-app revalidation bridge.
 * Returns `[]` when the backend is unreachable (fail open: a missing list
 * must never blank every og:image on the site).
 */
export async function getExcludedMediaUrls(): Promise<string[]> {
    'use cache';
    cacheLife('hours');
    cacheTag('media-indexing');

    const data = await publicGet<string[]>('/media-gallery/excluded-urls');
    return data ?? [];
}

/**
 * Filter a candidate image-URL list down to the ones allowed in SEO surfaces.
 * Nulls/undefined drop out; order is preserved.
 */
export async function filterIndexableImages(
    urls: Array<string | null | undefined>,
): Promise<string[]> {
    const excluded = new Set((await getExcludedMediaUrls()).map(normalizeUrl));
    return urls.filter(
        (u): u is string => !!u && !excluded.has(normalizeUrl(u)),
    );
}

/** One asset's localized copy. `url` is always the query-stripped form. */
export type MediaSeo = {
    url: string;
    title: string | null;
    description: string | null;
    altText: string | null;
};

/**
 * Must match `MEDIA_SEO_MAX_URLS` in the backend DTO - it 400s above this, and a
 * rejected batch would blank every alt text on the page.
 */
const MAX_MEDIA_SEO_URLS = 50;

/**
 * Localized media copy for a batch of image URLs, straight off the backend.
 *
 * Cached per (url-set, locale): the cache key includes the arguments, so each
 * page shape gets its own entry. That is intended - the alternative, fetching
 * the whole library once, grows without bound as the media library does.
 *
 * Returns `[]` when the backend is unreachable. FAIL OPEN, deliberately: a media
 * outage must degrade to the caller's own fallback text (a tour title, a
 * destination name), never to blank `alt` attributes across the site.
 */
async function fetchMediaSeo(
    urls: string[],
    locale: string,
): Promise<MediaSeo[]> {
    'use cache';
    cacheLife('hours');
    cacheTag('media-seo');

    // Repeated `url` params, not CSV: Cloudinary bakes commas into
    // transformation segments (`c_scale,w_2.0`), so a CSV would shred them.
    // `URLSearchParams.append` (not `set`) is what allows the repeat, which is
    // why this does not go through the shared `buildQuery` helper.
    const qs = new URLSearchParams({ locale });
    for (const url of urls) qs.append('url', url);

    const data = await publicGet<MediaSeo[]>(`/media-gallery/seo?${qs}`);
    return data ?? [];
}

/**
 * Localized `title` / `description` / `altText` for the given image URLs, keyed
 * by the QUERY-STRIPPED URL.
 *
 * Always look up with `normalizeUrl(yourUrl)`: every stored Cloudinary URL
 * carries an `?_a=` analytics param, and the one on an entity row need not match
 * the one in the media library, so matching raw strings silently misses.
 *
 * Nulls drop out and duplicates collapse before the request. Beyond
 * `MAX_MEDIA_SEO_URLS` the list is truncated rather than 400ing the whole batch -
 * no real page renders that many images, and losing alt text on image 51 beats
 * losing it on all of them.
 */
export async function getMediaSeo(
    urls: Array<string | null | undefined>,
    locale: string,
): Promise<Map<string, MediaSeo>> {
    const unique = [
        ...new Set(urls.filter((u): u is string => !!u).map(normalizeUrl)),
    ].slice(0, MAX_MEDIA_SEO_URLS);

    if (unique.length === 0) return new Map();

    const rows = await fetchMediaSeo(unique, locale);
    return new Map(rows.map(row => [normalizeUrl(row.url), row]));
}
