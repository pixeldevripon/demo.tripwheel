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

/** Compare ignoring query strings (Cloudinary appends analytics params). */
function normalizeUrl(url: string): string {
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
