/**
 * Neutral query-string helper shared by both the client-side (`lib/api/fetch.ts`)
 * and server-side (`lib/api/public/fetch.ts`) data layers. Pure and isomorphic —
 * deliberately NOT `server-only`, so it is safe to import from client code.
 */

/** Build a `?a=b&c=d` query string, dropping empty/undefined/null values. */
export function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}
