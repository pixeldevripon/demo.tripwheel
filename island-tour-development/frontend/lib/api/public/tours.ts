/**
 * Public tour-listing data (server-side, cached). Backs destination-page tour
 * grids (e.g. "Locals' favorites"). Hits the public `GET /tours` listing, which
 * returns LIVE tours with localized titles, hero image, price, rating, and the
 * `isLocalsFavourite` flag - the same shape as a search hit (`SearchHit`).
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { SearchHit } from '@/types/search';
import type { Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import { buildQuery, publicGet } from './fetch';

export interface TourListResult {
  total: number;
  data: SearchHit[];
}

/**
 * LIVE tours for a destination (by id), ordered `recommended` by default. Pass
 * `localsFavourite` to restrict to flagged tours, `limit: 1` to cheaply read the
 * destination-wide `total`. Returns `{ total: 0, data: [] }` if the backend is
 * unreachable.
 *
 * Cached hourly and tagged `tours`; every param is part of the cache key.
 */
export async function getDestinationTours(params: {
  destinationId: string;
  locale?: Locale;
  localsFavourite?: boolean;
  sort?: 'recommended' | 'price_asc' | 'price_desc' | 'rating' | 'newest';
  limit?: number;
  page?: number;
}): Promise<TourListResult> {
  'use cache';
  cacheLife('hours');
  cacheTag('tours');

  const { destinationId, locale = DEFAULT_LOCALE, localsFavourite, sort, limit, page } = params;
  const res = await publicGet<TourListResult>(
    `/tours${buildQuery({
      destinationId,
      locale,
      isLocalsFavourite: localsFavourite,
      sort,
      limit,
      page,
    })}`,
  );
  return res ?? { total: 0, data: [] };
}
