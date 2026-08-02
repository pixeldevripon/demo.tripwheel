/**
 * Public faceted-filter data (server-side, cached). Backs the filter modal's
 * dynamic price bounds + attribute sections. Two variants:
 *  - destination-wide (All Tours page): `GET /filters/:dest`
 *  - category-scoped (category page):    `GET /filters/:dest/:cat`
 * Returns `null` when the destination/category is unknown or the backend is
 * unreachable - callers fall back to static bounds and no attribute sections.
 */
import { seg } from '@/lib/api/api-path';
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { TourFacets } from '@/types/facets';
import { publicGet } from './fetch';

/** Destination-wide facets (no category). Cached daily (tag-busted on writes). */
export async function getDestinationFacets(
  destinationSlug: string,
): Promise<TourFacets | null> {
  'use cache';
  cacheLife('days');
  cacheTag('tours', 'categories');

  return publicGet<TourFacets>(`/filters/${seg(destinationSlug)}`);
}

/** Category-scoped facets. Cached daily (tag-busted on writes). */
export async function getCategoryFacets(
  destinationSlug: string,
  categorySlug: string,
): Promise<TourFacets | null> {
  'use cache';
  cacheLife('days');
  cacheTag('tours', 'categories');

  return publicGet<TourFacets>(`/filters/${seg(destinationSlug)}/${seg(categorySlug)}`);
}
