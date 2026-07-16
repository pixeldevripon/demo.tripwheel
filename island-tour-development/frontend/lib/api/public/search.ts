/**
 * Public tour search (server-side, cached). Backs the /[locale]/search results
 * page and the navbar typeahead. Hits `GET /search` (public), which matches tour
 * title/overview + category & hub names and returns LIVE tours only.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import type { Currency, Locale } from '@/lib/constants/locales';
import { DEFAULT_LOCALE } from '@/lib/constants/locales';
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
 * Cached briefly and tagged `search`; a query+locale(+destination)+page combo is
 * the cache key.
 */
export async function searchTours(params: {
  q: string;
  locale?: Locale;
  /** Shopper display currency; adds converted `money` to each hit (guide §20.9). */
  currency?: Currency;
  destinationSlug?: string;
  /** YYYY-MM-DD — restricts to tours with an OPEN departure on that date. */
  date?: string;
  page?: number;
  limit?: number;
}): Promise<SearchResults> {
  'use cache';
  cacheLife('minutes');
  cacheTag('search');

  const q = params.q?.trim() ?? '';
  if (q.length < 2) return EMPTY(q);

  const {
    locale = DEFAULT_LOCALE,
    currency,
    destinationSlug,
    date,
    page,
    limit,
  } = params;
  const data = await publicGet<SearchResults>(
    `/search${buildQuery({ q, locale, currency, destinationSlug, date, page, limit })}`,
  );
  return data ?? EMPTY(q);
}
