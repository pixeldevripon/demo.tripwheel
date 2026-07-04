/**
 * Public faceted-filter data (server-side, cached). Backs the filter modal's
 * dynamic price bounds + attribute sections. Two variants:
 *  - destination-wide (All Tours page): `GET /filters/:dest`
 *  - category-scoped (category page):    `GET /filters/:dest/:cat`
 * Returns `null` when the destination/category is unknown or the backend is
 * unreachable - callers fall back to static bounds and no attribute sections.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { TourFacets } from '@/types/facets';
import { publicGet } from './fetch';

/** Destination-wide facets (no category). Cached hourly. */
export async function getDestinationFacets(
  destinationSlug: string,
): Promise<TourFacets | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('tours', 'categories');

  return publicGet<TourFacets>(`/filters/${destinationSlug}`);
}

/** Category-scoped facets. Cached hourly. */
export async function getCategoryFacets(
  destinationSlug: string,
  categorySlug: string,
): Promise<TourFacets | null> {
  'use cache';
  cacheLife('hours');
  cacheTag('tours', 'categories');

  return publicGet<TourFacets>(`/filters/${destinationSlug}/${categorySlug}`);
}
