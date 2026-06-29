/**
 * Shared client-side fetch helpers for dashboard API modules.
 *
 * Always sends the Better Auth session cookie (`credentials: 'include'`) and
 * normalises error bodies (string or string[] `message`) into a thrown Error.
 */
const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

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
  return res.json() as Promise<T>;
}

// Re-exported from the shared neutral util so existing `@/lib/api/fetch` imports
// keep working.
export { buildQuery } from './query';
