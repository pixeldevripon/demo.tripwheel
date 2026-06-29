/**
 * Client-side tour search — backs the navbar typeahead (live, abortable per
 * keystroke). The results page uses the server-cached loader in
 * `lib/api/public/search.ts`; this one runs in the browser.
 */
import type { Locale } from '@/lib/constants/locales';
import type { SearchResults } from '@/types/search';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

/**
 * Search LIVE tours from the browser. Terms shorter than 2 chars short-circuit
 * to an empty result (the backend rejects them). Pass an AbortSignal to cancel
 * an in-flight request when the query changes. Returns an empty result set on
 * any failure (including aborts) so callers never need a try/catch.
 */
export async function searchToursClient(
  params: { q: string; locale?: Locale; destinationSlug?: string; limit?: number },
  signal?: AbortSignal,
): Promise<SearchResults> {
  const q = params.q.trim();
  const empty: SearchResults = { total: 0, page: 1, limit: params.limit ?? 8, query: q, data: [] };
  if (q.length < 2) return empty;

  const qs = new URLSearchParams({ q });
  if (params.locale) qs.set('locale', params.locale);
  if (params.destinationSlug) qs.set('destinationSlug', params.destinationSlug);
  qs.set('limit', String(params.limit ?? 8));

  try {
    const res = await fetch(`${BASE_URL}/search?${qs.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
      signal,
    });
    if (!res.ok) return empty;
    return (await res.json()) as SearchResults;
  } catch {
    return empty;
  }
}
