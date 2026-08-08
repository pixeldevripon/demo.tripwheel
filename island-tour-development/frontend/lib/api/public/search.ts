/**
 * Public tour search (server-side, cached). Backs the /[locale]/search results
 * page and the navbar typeahead. Hits `GET /search` (public), which matches tour
 * title/overview + category & hub names and returns LIVE tours only.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { Currency, Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
import type { SearchBackendSort } from '@/lib/tours/filters';
import type { SearchResults } from '@/types/search';
import { buildQuery, publicGet } from './fetch';

export type { SearchHit, SearchResults } from '@/types/search';

const EMPTY = (query: string): SearchResults => ({
  total: 0,
  page: 1,
  limit: 20,
  query,
  data: [],
});

/**
 * Search LIVE tours. The backend requires a term of at least 2 characters; we
 * short-circuit shorter terms to an empty result (no request). Optionally scope
 * to a destination slug. Returns an empty result set on any backend failure.
 *
 * Takes the same filter + sort params as the listing endpoint, because the
 * results page mounts the same toolbar (Pastel #44); `sort` additionally accepts
 * `relevance`, which is the page's default.
 *
 * Cached briefly and tagged `search`; the whole param set is the cache key.
 */
export async function searchTours(params: {
  q: string;
  locale?: Locale;
  /** Shopper display currency; adds converted `money` to each hit (guide §20.9). */
  currency?: Currency;
  destinationSlug?: string;
  /** `relevance` (default) | `recommended` | `price_asc` | `price_desc`. */
  sort?: SearchBackendSort;
  /** CSV of category ids; a tour in ANY of them matches (quick-filter chips). */
  categoryIds?: string;
  /** YYYY-MM-DD — restricts to tours with an OPEN departure on that date. */
  date?: string;
  /** Party size; only applied together with `date`. */
  guests?: number;
  /** CSV of morning|afternoon|evening; only applied together with `date`. */
  timeOfDay?: string;
  minPrice?: number;
  maxPrice?: number;
  durationMin?: number;
  durationMax?: number;
  ratingMin?: number;
  cancellationMaxHours?: number;
  pickupAvailable?: boolean;
  page?: number;
  limit?: number;
}): Promise<SearchResults> {
  'use cache';
  cacheLife('minutes');
  cacheTag('search');

  const q = params.q?.trim() ?? '';
  if (q.length < 2) return EMPTY(q);

  const { locale = DEFAULT_LOCALE, ...rest } = params;
  const data = await publicGet<SearchResults>(
    `/search${buildQuery({ ...rest, q, locale })}`,
  );
  return data ?? EMPTY(q);
}
