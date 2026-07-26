import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { publicGet } from './fetch';

export type SitemapEntryType =
    | 'destination'
    | 'category'
    | 'hub'
    | 'collection'
    | 'tour'
    | 'page';

/** One indexable, locale-less URL from the backend enumeration. */
export interface SitemapEntry {
    path: string;
    lastModified: string;
    type: SitemapEntryType;
}

/**
 * Every indexable public URL (active destinations, LIVE tours, tour-gated
 * categories/hubs, published collections, published Pages) from
 * `GET /sitemap/entries`.
 *
 * Tagged with every coarse entity tag it aggregates, so ANY entity write that
 * changes what renders (publish/unpublish a tour, toggle a hub, rename a slug)
 * busts the sitemap through the existing dashboard revalidation bridge - no new
 * cache tag, no contract change. Empty array on outage keeps `/sitemap.xml`
 * valid (just the static routes) rather than 500ing.
 */
export async function getSitemapEntries(): Promise<SitemapEntry[]> {
    'use cache';
    cacheLife('hours');
    cacheTag(
        'tours',
        'destinations',
        'categories',
        'hubs',
        'collections',
        'slug-registry',
        'pages',
    );

    const res = await publicGet<SitemapEntry[]>('/sitemap/entries');
    return res ?? [];
}
