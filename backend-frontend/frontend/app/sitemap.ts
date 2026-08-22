import type { MetadataRoute } from 'next';

import { getSitemapEntries, type SitemapEntryType } from '@/lib/api/public/sitemap';
import { ALL_LOCALES, DEFAULT_LOCALE } from '@/lib/constants/locales';
import { getSiteUrl } from '@/lib/seo/site-url';

/**
 * `/sitemap.xml` for the public marketing site.
 *
 * Composes two sources into per-page URLs that each carry the full hreflang set
 * (7 locales + x-default), following the Next localized-sitemap convention (one
 * `url` per page = the English default, alternates in `alternates.languages`):
 *
 *   - STATIC routes this app owns (home, each destination's All-Tours page) -
 *     it knows these without the backend.
 *   - DYNAMIC entities from `GET /sitemap/entries` (active destinations, LIVE
 *     tours, tour-gated categories/hubs, published collections, and published
 *     Pages - the legal/policy permalinks arrive as `type: 'page'` rather than
 *     being hardcoded here, so publishing/unpublishing one updates the sitemap).
 *
 * changeFrequency/priority are assigned by page kind. Private / noindex routes
 * (checkout, thank-you, cancel, review, bookings, wishlist, search) are never
 * enumerated here and are also blocked in robots.txt.
 */

const PRIORITY: Record<SitemapEntryType | 'home' | 'allTours', number> = {
    home: 1,
    destination: 0.9,
    tour: 0.8,
    allTours: 0.7,
    category: 0.7,
    hub: 0.6,
    collection: 0.6,
    page: 0.3,
};

const CHANGE_FREQ: Record<
    SitemapEntryType | 'home' | 'allTours',
    MetadataRoute.Sitemap[number]['changeFrequency']
> = {
    home: 'daily',
    destination: 'weekly',
    tour: 'weekly',
    allTours: 'daily',
    category: 'weekly',
    hub: 'weekly',
    collection: 'weekly',
    page: 'yearly',
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const [siteUrl, entries] = await Promise.all([
        getSiteUrl(),
        getSitemapEntries(),
    ]);

    /** Build the 7-locale hreflang map (+ x-default -> en) for a locale-less path. */
    const languagesFor = (path: string): Record<string, string> => {
        const languages: Record<string, string> = {};
        for (const loc of ALL_LOCALES) languages[loc] = `${siteUrl}/${loc}${path}`;
        languages['x-default'] = `${siteUrl}/${DEFAULT_LOCALE}${path}`;
        return languages;
    };

    /** One <url> per page: loc = the English default, alternates = every locale. */
    const toUrl = (
        path: string,
        kind: keyof typeof PRIORITY,
        lastModified: string | Date,
    ): MetadataRoute.Sitemap[number] => ({
        url: `${siteUrl}/${DEFAULT_LOCALE}${path}`,
        lastModified,
        changeFrequency: CHANGE_FREQ[kind],
        priority: PRIORITY[kind],
        alternates: { languages: languagesFor(path) },
    });

    const now = new Date();
    const urls: MetadataRoute.Sitemap = [];

    // Home.
    urls.push(toUrl('', 'home', now));

    // Dynamic entities + each destination's All-Tours page. Legal/policy
    // pages arrive as `type: 'page'` entries from the Pages system.
    for (const entry of entries) {
        urls.push(toUrl(entry.path, entry.type, entry.lastModified));
        if (entry.type === 'destination') {
            urls.push(toUrl(`${entry.path}/tours`, 'allTours', entry.lastModified));
        }
    }

    return urls;
}
