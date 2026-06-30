/**
 * Public hub data (server-side, cached). Backs the destination page's discovery
 * rows (hero "Popular" + "Explore by type"). Hits the tour-gated
 * `GET /hubs/destination/:slug`, so every returned hub is PUBLISHED, active, and
 * has at least one published tour (its link never 404s).
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { HubByDestination } from '@/types/hub';
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
