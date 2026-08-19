/**
 * Shared client-side fetch helpers for dashboard API modules.
 *
 * Always sends the Better Auth session cookie (`credentials: 'include'`) and
 * throws `ApiError` for every failure. The CONTRACT of `ApiError.message` is
 * that it is human-readable and safe to put in a toast verbatim - raw
 * technical text ("Internal server error", "Failed to fetch",
 * "Unexpected token '<'", ThrottlerException, unbounded validation dumps)
 * must never leave this file. Callers that need to branch on specifics get
 * `status` and the raw backend `body`. The wording itself lives in
 * `lib/api/humane-error.ts`, shared with the server actions.
 */
import { revalidatePublicForPath } from './cache-revalidation';
import {
    ApiError,
    humaneMessage,
    NETWORK_MESSAGE,
    SERVER_MESSAGE,
} from './humane-error';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

// Base backoff (ms) between retries, one entry per retry attempt. A dashboard
// page mounts many parallel queries at once; if a burst briefly trips the
// backend's per-IP throttle, a short retry lets it self-heal instead of
// surfacing a 429 to the user.
const RETRY_BACKOFF_MS = [300, 800];

// Full jitter on top of the base delay. Without it, N parallel GETs that all
// 429 together would retry in lockstep and re-collide on the same throttle
// window; jitter spreads them out. Client-side, so Math.random is fine here
// (unlike the `'use cache'` server fetch layer, which bans it).
const sleep = (base: number) =>
    new Promise<void>((resolve) =>
        setTimeout(resolve, base + Math.floor(Math.random() * base)),
    );

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const request = async (): Promise<Response> => {
    try {
      return await fetch(`${BASE_URL}${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...init?.headers },
        ...init,
      });
    } catch {
      // fetch() only rejects on network-level failure (offline, DNS, CORS,
      // backend down). The browser's TypeError text ("Failed to fetch" /
      // "Load failed") is not for users.
      throw new ApiError(NETWORK_MESSAGE, 0);
    }
  };

  let res = await request();
  // Retry only transient 429/503, and only for idempotent GETs (default) - a
  // retried POST/PATCH/DELETE could double-apply a mutation.
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'GET') {
    for (
      let attempt = 0;
      (res.status === 429 || res.status === 503) && attempt < RETRY_BACKOFF_MS.length;
      attempt++
    ) {
      await sleep(RETRY_BACKOFF_MS[attempt]);
      res = await request();
    }
  }

  if (!res.ok) {
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      // Non-JSON error body (an HTML page from a proxy) - the status-based
      // mapping below covers it.
    }
    throw new ApiError(humaneMessage(res.status, body), res.status, body);
  }

  // A successful write may change public content - bust the affected public
  // cache tags so the change shows up on the live site immediately.
  revalidatePublicForPath(path, method);

  if (res.status === 204) return undefined as T;
  // Some mutations (e.g. DELETE) reply 200/201 with an empty body. Parsing that
  // as JSON throws "Unexpected end of JSON input", so read text first and only
  // parse when there is content.
  const text = await res.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    // A 2xx with a non-JSON body means something between us and the backend
    // answered instead (proxy error page). The SyntaxError's "Unexpected
    // token '<'..." must never reach a toast.
    throw new ApiError(SERVER_MESSAGE, res.status);
  }
}

// Re-exported so callers can branch on `err instanceof ApiError` / `err.status`
// without importing a second module.
export { ApiError } from './humane-error';

// Re-exported from the shared neutral util so existing `@/lib/api/fetch` imports
// keep working.
export { buildQuery } from './query';
