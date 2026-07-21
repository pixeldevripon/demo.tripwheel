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

/**
 * Which public layout the admin picked (Settings > Instagram).
 *   GRID    - the curated Figma band: rounded 384x337 cards, generous gutters.
 *   GALLERY - the Instagram profile look: 4:5 portraits, hairline gutters.
 */
export type InstagramLayout = 'GRID' | 'GALLERY';

export interface InstagramTile {
    id: string;
    /**
     * Always a URL we control; Instagram CDN links expire, so they never reach
     * here. On a reel tile this is the poster the grid paints first.
     */
    imageUrl: string;
    /** Set on a reel tile: played muted and looped over the poster. */
    videoUrl: string | null;
    /** Never empty - falls back to the account profile, so a tile is never a dead link. */
    href: string;
    alt: string;
    /**
     * Part of the payload, but nothing on the public site reads it: the corner
     * badges these two drove (reel / carousel / pin) were removed - that glyph
     * set is Instagram's product chrome, not ours. Kept so this stays a faithful
     * mirror of the backend response. Reintroducing a badge from them would be a
     * design decision, not a fix.
     */
    mediaType: InstagramMediaType;
    /** Unused here too - and never affected order; displayOrder owns that. */
    isPinned: boolean;
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
    /** Admin-chosen; the section renders one of two layouts from it. */
    layout: InstagramLayout;
    posts: InstagramTile[];
}

const EMPTY_FEED: InstagramFeed = {
    enabled: false,
    username: null,
    profileUrl: null,
    layout: 'GRID',
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
    /** Omit to let the layout choose (6 for the grid, 18 for the gallery). */
    limit?: number,
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
