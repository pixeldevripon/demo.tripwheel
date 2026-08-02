/**
 * Client-side tour search — backs the navbar typeahead (live, abortable per
 * keystroke). The results page uses the server-cached loader in
 * `lib/api/public/search.ts`; this one runs in the browser.
 */
import type { Currency, Locale } from '@/lib/constants/locales';
import type { SearchResults, SearchSuggest } from '@/types/search';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * Search LIVE tours from the browser. Terms shorter than 2 chars short-circuit
 * to an empty result (the backend rejects them). Pass an AbortSignal to cancel
 * an in-flight request when the query changes. Returns an empty result set on
 * any failure (including aborts) so callers never need a try/catch.
 */
export async function searchToursClient(
  params: {
    q: string;
    locale?: Locale;
    currency?: Currency;
    destinationSlug?: string;
    date?: string;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<SearchResults> {
  const q = params.q.trim();
  const empty: SearchResults = { total: 0, page: 1, limit: params.limit ?? 8, query: q, data: [] };
  if (q.length < 2) return empty;

  const qs = new URLSearchParams({ q });
  if (params.locale) qs.set('locale', params.locale);
  if (params.currency) qs.set('currency', params.currency);
  if (params.destinationSlug) qs.set('destinationSlug', params.destinationSlug);
  if (params.date) qs.set('date', params.date);
  qs.set('limit', String(params.limit ?? 8));

  try {
    const res = await fetch(`${BACKEND_API_BASE}/search?${qs.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
      signal,
    });
    if (!res.ok) return empty;
    return (await res.json()) as SearchResults;
  } catch {
    return empty;
  }
}

/**
 * Typeahead suggestions across entity types (categories, hubs, tours in and
 * beyond the active destination). Same failure contract as searchToursClient:
 * empty buckets on any error, so the dropdown never needs a try/catch.
 */
export async function searchSuggestClient(
  params: {
    q: string;
    locale?: Locale;
    currency?: Currency;
    destinationSlug?: string;
  },
  signal?: AbortSignal,
): Promise<SearchSuggest> {
  const q = params.q.trim();
  const empty: SearchSuggest = {
    query: q,
    total: 0,
    categories: [],
    hubs: [],
    tours: [],
    beyondTours: [],
  };
  if (q.length < 2) return empty;

  const qs = new URLSearchParams({ q });
  if (params.locale) qs.set('locale', params.locale);
  if (params.currency) qs.set('currency', params.currency);
  if (params.destinationSlug) qs.set('destinationSlug', params.destinationSlug);

  try {
    const res = await fetch(`${BACKEND_API_BASE}/search/suggest?${qs.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
      signal,
    });
    if (!res.ok) return empty;
    return (await res.json()) as SearchSuggest;
  } catch {
    return empty;
  }
}
