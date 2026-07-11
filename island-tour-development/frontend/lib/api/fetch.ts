/**
 * Shared client-side fetch helpers for dashboard API modules.
 *
 * Always sends the Better Auth session cookie (`credentials: 'include'`) and
 * normalises error bodies (string or string[] `message`) into a thrown Error.
 */
import { revalidatePublicForPath } from './cache-revalidation';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

// Fixed backoff (ms) between retries, one entry per retry attempt. A dashboard
// page mounts many parallel queries at once; if a burst briefly trips the
// backend's per-IP throttle, a short retry lets it self-heal instead of
// surfacing a 429 to the user.
const RETRY_BACKOFF_MS = [300, 800];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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

  // A successful write may change public content - bust the affected public
  // cache tags so the change shows up on the live site immediately.
  revalidatePublicForPath(path, method);

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
