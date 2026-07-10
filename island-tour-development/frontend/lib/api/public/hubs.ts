/**
 * Public hub data (server-side, cached). Backs the destination page's discovery
 * rows (hero "Popular" + "Explore by type"). Hits the tour-gated
 * `GET /hubs/destination/:slug`, so every returned hub is PUBLISHED, active, and
 * has at least one published tour (its link never 404s).
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { HubByDestination, HubPageContent, HubRender } from '@/types/hub';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet } from './fetch';

/**
 * Tour-gated, published hubs for a destination (localized names, ordered by name,
 * each with `publishedTourCount`). Returns `[]` if the backend is unreachable.
 *
 * Cached hourly and tagged `hubs`; `destinationSlug` + `locale` are the cache key.
 */
export async function getDestinationHubs(
  destinationSlug: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<HubByDestination[]> {
  'use cache';
  cacheLife('hours');
  cacheTag('hubs');

  const data = await publicGet<HubByDestination[]>(
    `/hubs/destination/${destinationSlug}${buildQuery({ locale })}`,
  );
  return data ?? [];
}

/**
 * Full render payload for a published hub page (master 5.5). `destinationId` (the
 * destination UUID) scopes the lookup; get it from `getDestinationBySlug(...).id`.
 * Returns `null` for a draft/inactive/unknown hub (backend 404) or when the backend
 * is unreachable - callers `notFound()` on null.
 *
 * Cached hourly and tagged `hubs`; `slug` + `destinationId` + `locale` are the key.
 * Bust with `revalidateTag('hubs')` after an admin edit.
 */
export async function getHubRender(
  slug: string,
  destinationId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<HubRender | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('hubs');

  return publicGet<HubRender>(
    `/hubs/render/${slug}${buildQuery({ destinationId, locale })}`,
  );
}

/**
 * Per-locale editorial meta (metaTitle / metaDescription / aboutText) for a hub by
 * id - authored in the dashboard SEO tab, used by `generateMetadata`. Returns
 * `null` when unset or the backend is unreachable. Cached hourly, tagged `hubs`.
 */
export async function getHubPageContent(
  hubId: string,
  locale: Locale = DEFAULT_LOCALE,
): Promise<HubPageContent | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('hubs');

  return publicGet<HubPageContent>(
    `/hubs/${hubId}/page-content${buildQuery({ locale })}`,
  );
}
