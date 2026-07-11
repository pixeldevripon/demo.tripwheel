import { cacheLife, cacheTag } from 'next/cache';

import type { SlugResolution } from '@/types/slug-registry';
import { publicFetch } from './public/fetch';

/**
 * Slug-registry resolver - the single lookup that disambiguates the polymorphic
 * `/{locale}/{destination}/{slug}/` segment into a concrete entity type + id.
 *
 * Contract (ROUTING-AND-RESOLUTION.md §5):
 *   GET /api/v1/slug-registry/resolve?destinationSlug={dest}&slug={slug}
 *     200 → { destinationSlug, slug, entityType, entityId }
 *     404 → slug is unknown OR inactive (tombstoned) - treat as not-found
 *
 * The endpoint is `@Public()` and locale-independent: one resolution serves all
 * 7 locales for a given `(destination, slug)` pair.
 */

/**
 * Resolve a `(destinationSlug, slug)` pair to its entity.
 * Returns `null` on a `404` (unknown or inactive slug) so callers can render
 * `notFound()` authoritatively. Also returns `null` on any transport/server
 * error (e.g. backend down during build) after `publicFetch` has retried a
 * transient 429/503, so a spike degrades to not-found rather than crashing.
 */
export async function resolveSlug(
    destinationSlug: string,
    slug: string
): Promise<SlugResolution | null> {
    // Public and immutable-by-slug, so cache it (Cache Components `use cache`,
    // not the legacy fetch cache). Two tags: the granular `slug:dest:slug` for
    // targeted busting, and the coarse `slug-registry` busted by any entity
    // create / delete / rename / (de)activate (see lib/api/cache-revalidation.ts),
    // since those change what a slug resolves to.
    'use cache';
    cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
    cacheTag(`slug:${destinationSlug}:${slug}`, 'slug-registry');

    const query = new URLSearchParams({ destinationSlug, slug }).toString();
    try {
        const res = await publicFetch(`/slug-registry/resolve?${query}`);
        if (res.status === 404 || !res.ok) return null;
        return (await res.json()) as SlugResolution;
    } catch {
        // Handle ECONNREFUSED when backend is down during build so Next.js can
        // gracefully fall back to 404/not-found instead of crashing the build.
        return null;
    }
}

