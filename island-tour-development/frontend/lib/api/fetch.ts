/**
 * Shared client-side fetch helpers for dashboard API modules.
 *
 * Always sends the Better Auth session cookie (`credentials: 'include'`) and
 * normalises error bodies (string or string[] `message`) into a thrown Error.
 *
 * NO CACHE REVALIDATION HERE, ON PURPOSE. This app is the CONSUMER side of the
 * cross-repo cache bridge, never the producer: dashboard writes arrive over HTTP
 * at `app/api/revalidate/route.ts`, which validates them against the shared
 * `lib/cache-tags.ts` contract and busts the tags. The pre-extraction producer
 * (`lib/api/cache-revalidation.ts` + `app/_actions/revalidate.ts`) was removed
 * because it had drifted from that contract - it was still carrying a
 * hand-written tag union with no `platform-reviews`, `homepage`, `instagram` or
 * `media-indexing`. A second, staler copy of the vocabulary in this repo is a
 * drift trap, and the only live writes routed through here (`/bookings/*`,
 * `/availability/check`) mapped to nothing anyway. If a public write ever does
 * need to bust a tag, do it at that call site against `lib/cache-tags.ts` - do
 * not reinstate a parallel map.
 */

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
  const request = () =>
    fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
      ...init,
    });

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
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  // Some mutations (e.g. DELETE) reply 200/201 with an empty body. Parsing that
  // as JSON throws "Unexpected end of JSON input", so read text first and only
  // parse when there is content.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// Re-exported from the shared neutral util so existing `@/lib/api/fetch` imports
// keep working.
export { buildQuery } from './query';
