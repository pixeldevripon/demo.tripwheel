/**
 * The brand Instagram grid (server-side, cached).
 *
 * Hits `GET /instagram/public/feed`, which serves tiles from our own media - the
 * site deliberately renders no third-party embed, so the grid is server-rendered
 * into the static shell like every other section.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { buildQuery, publicGet } from './fetch';

export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

export interface InstagramTile {
    id: string;
    /** Always a URL we control; Instagram CDN links expire, so they never reach here. */
    imageUrl: string;
    /** Never empty - falls back to the account profile, so a tile is never a dead link. */
    href: string;
    alt: string;
    mediaType: InstagramMediaType;
    width: number | null;
    height: number | null;
}

export interface InstagramFeed {
    /**
     * The one gate the section obeys: false when an admin switched the grid off
     * OR when there is nothing to show. A handle row above an empty grid is
     * worse than no section at all.
     */
    enabled: boolean;
    /** Handle without '@' - the header row adds it. */
    username: string | null;
    profileUrl: string | null;
    posts: InstagramTile[];
}

const EMPTY_FEED: InstagramFeed = {
    enabled: false,
    username: null,
    profileUrl: null,
    posts: [],
};

/**
 * Curated tiles change on an admin's schedule, so `cacheLife('days')` on the
 * `instagram` tag: dashboard writes bust it immediately (see
 * lib/cache-revalidation.ts in the dashboard repo), and the phase-2 sync job
 * will bust the same tag from the backend.
 *
 * `publicGet` (not strict) on purpose: this section is decoration, so a backend
 * outage degrades to "no Instagram section" rather than failing the destination
 * page it sits on.
 */
export async function getInstagramFeed(
    destination?: string,
    limit = 6,
): Promise<InstagramFeed> {
    'use cache';
    cacheLife('days');
    cacheTag('instagram');

    const res = await publicGet<InstagramFeed>(
        `/instagram/public/feed${buildQuery({ destination, limit })}`,
    );

    // An older backend (pre-Instagram module) 404s here, which publicGet
    // reports as null - same as an outage, and the same empty section.
    return res ?? EMPTY_FEED;
}
