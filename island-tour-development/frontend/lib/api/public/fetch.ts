/**
 * Shared server-side fetch primitives for the public (frontend) site.
 *
 * These run in Server Components, hit only `@Public()` backend endpoints, and
 * never send the Better Auth cookie (that is the client-side `lib/api/fetch.ts`).
 * Caching is owned by the calling `'use cache'` scope (Next 16 Cache Components),
 * so no fetch-level cache options are set here.
 */
import 'server-only';

// Re-exported so public data modules can `import { publicGet, buildQuery } from './fetch'`.
export { buildQuery } from '../query';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

/**
 * Plain GET against a public backend endpoint. Returns `null` on any failure
 * (network error, non-2xx, bad JSON) so callers can fall back to a safe default
 * instead of throwing and blanking the prerendered page.
 */
export async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
