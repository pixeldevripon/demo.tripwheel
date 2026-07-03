import { cacheLife, cacheTag } from 'next/cache';

import type { SlugResolution } from '@/types/slug-registry';

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

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

/**
 * Resolve a `(destinationSlug, slug)` pair to its entity.
 * Returns `null` on a `404` (unknown or inactive slug) so callers can render
 * `notFound()` authoritatively. Throws on any other transport/server error.
 */
export async function resolveSlug(
    destinationSlug: string,
    slug: string,
): Promise<SlugResolution | null> {
    // Public and immutable-by-slug, so cache it (Cache Components `use cache`,
    // not the legacy fetch cache). Bust on the rare isActive toggle via the tag.
    'use cache';
    cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
    cacheTag(`slug:${destinationSlug}:${slug}`);

    const query = new URLSearchParams({ destinationSlug, slug }).toString();
    const res = await fetch(`${BASE_URL}/slug-registry/resolve?${query}`, {
        headers: { 'Content-Type': 'application/json' },
    });

    if (res.status === 404) return null;
    if (!res.ok) {
        throw new Error(`Slug resolve failed for "${destinationSlug}/${slug}" (${res.status})`);
    }
    return res.json() as Promise<SlugResolution>;
}
