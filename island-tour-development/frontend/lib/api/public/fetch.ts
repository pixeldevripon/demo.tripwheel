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
 * Headers for a first-party server-side request.
 *
 * Adds the internal API secret when configured, so the backend can identify this
 * SSR/build server as a trusted origin and skip its per-IP rate limiter (see the
 * backend `AuthModule` `skipIf`). The secret is server-only (`INTERNAL_API_SECRET`,
 * never `NEXT_PUBLIC_`), so it is never shipped to the browser.
 */
function serverHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const secret = process.env.INTERNAL_API_SECRET;
  if (secret) headers['x-internal-api-key'] = secret;
  return headers;
}

// Fixed backoff (ms) between retries, one entry per retry attempt. No random
// jitter and no time reads: this runs inside `'use cache'` scopes, where
// `Math.random()` / `Date.now()` are disallowed by Next.js.
const RETRY_BACKOFF_MS = [300, 800];

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * GET a public backend endpoint as the trusted SSR/build origin. Retries a 429
 * (rate-limited) or 503 (unavailable) a couple of times with fixed backoff, so a
 * transient burst during prerendering does not fail or blank a page. Returns the
 * raw Response - callers decide how to interpret each status code.
 */
export async function publicFetch(path: string): Promise<Response> {
  let res = await fetch(`${BASE_URL}${path}`, { headers: serverHeaders() });
  for (
    let attempt = 0;
    (res.status === 429 || res.status === 503) &&
    attempt < RETRY_BACKOFF_MS.length;
    attempt++
  ) {
    await sleep(RETRY_BACKOFF_MS[attempt]);
    res = await fetch(`${BASE_URL}${path}`, { headers: serverHeaders() });
  }
  return res;
}

/**
 * Plain GET against a public backend endpoint. Returns `null` on any failure
 * (network error, non-2xx, bad JSON) so callers can fall back to a safe default
 * instead of throwing and blanking the prerendered page.
 *
 * NEVER use this for data a page gates with `notFound()` - use `publicGetStrict`
 * there, or a backend outage gets baked into the route cache as a real 404.
 */
export async function publicGet<T>(path: string): Promise<T | null> {
  try {
    const res = await publicFetch(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Thrown by `publicGetStrict` when the backend is unreachable or answers with
 * anything other than 2xx/404. Extends the base error only to carry a stable
 * `name` for logs; callers are not expected to catch it (see below).
 */
export class BackendUnavailableError extends Error {
  constructor(path: string, detail: string) {
    super(`Public API unavailable for ${path}: ${detail}`);
    this.name = 'BackendUnavailableError';
  }
}

/**
 * GET for data that a page gates with `notFound()`. Unlike `publicGet`, this
 * distinguishes "the backend said this does not exist" from "the backend could
 * not be asked":
 *
 *   - 2xx  -> parsed body
 *   - 404  -> `null` (a genuine not-found; the caller may `notFound()`)
 *   - anything else (network error, 5xx, 429 after retries, bad JSON)
 *     -> throws `BackendUnavailableError`
 *
 * The throw is the point: inside a `'use cache'` loader it aborts the render, so
 * an ISR background revalidation FAILS and Next keeps serving the last good
 * prerendered page instead of caching a 404 over it. (With the old swallow-to-null
 * behavior, a backend outage during revalidation replaced every destination page
 * with a cached 404.) At build time it fails the build loudly - which requires the
 * backend to be up during `next build`, and is still better than silently baking
 * 404s for every prerendered route.
 */
export async function publicGetStrict<T>(path: string): Promise<T | null> {
  let res: Response;
  try {
    res = await publicFetch(path);
  } catch (err) {
    throw new BackendUnavailableError(
      path,
      err instanceof Error ? err.message : 'network error',
    );
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new BackendUnavailableError(path, `HTTP ${res.status}`);
  try {
    return (await res.json()) as T;
  } catch {
    throw new BackendUnavailableError(path, 'invalid JSON body');
  }
}
