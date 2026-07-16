'use server';

import { updateTag } from 'next/cache';

/**
 * Coarse cache tags used across the `'use cache'` data layer. Busting one
 * regenerates every cached read that carries it - use for aggregates (listings,
 * search, facets) and cross-entity ripple (a tour appears on many pages).
 *
 * `slug-registry` guards the router's slug->entity resolver; `user-profile` is
 * the per-user dashboard profile cache (not public content, but the same
 * invalidation mechanism).
 */
export type CoarseCacheTag =
  | 'tours'
  | 'search'
  | 'hubs'
  | 'categories'
  | 'collections'
  | 'destinations'
  | 'reviews'
  | 'slug-registry'
  // Public SiteInfo (logo, WhatsApp number + flag, Instagram). Read by the
  // footer and every NeedHelp surface, so a Settings > General save has to bust
  // it or the site keeps serving the old number until the cacheLife expires.
  | 'site-info'
  | 'user-profile';

/**
 * Granular per-entity tags. A detail/render read tags itself `type:<id>` so
 * editing ONE entity regenerates only that entity's page, not every page of its
 * type. The id is the entity UUID (the dashboard mutation path carries it).
 */
export type GranularCacheTag =
  | `tour:${string}`
  | `destination:${string}`
  | `hub:${string}`
  | `category:${string}`
  | `collection:${string}`
  // Operator company name/logo is embedded on the tour detail page (only there,
  // not on cards); an operator edit busts this to refresh exactly that operator's
  // tour pages without touching every tour.
  | `operator:${string}`;

export type CacheTag = CoarseCacheTag | GranularCacheTag;

/**
 * Immediately expire the given cache tags so the next request to any affected
 * page re-fetches fresh data.
 *
 * Uses `updateTag` (not `revalidateTag`) for immediate invalidation - the very
 * next visitor sees the change, which is what admins expect after saving.
 * `updateTag` is only callable from a Server Action, which is exactly this; the
 * dashboard invokes it over RPC after a successful mutation (see
 * `lib/api/cache-revalidation.ts`).
 */
export async function revalidateCacheTags(tags: CacheTag[]): Promise<void> {
  for (const tag of tags) {
    updateTag(tag);
  }
}
