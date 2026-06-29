/**
 * Client-side wishlist API (authenticated; sends the Better Auth cookie).
 * The wishlist is a per-user, dynamic resource, so it is always fetched in the
 * browser — never in the cached server shell.
 */
import type { Locale } from '@/lib/constants/locales';
import type { SearchHit } from '@/types/search';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

/** A saved tour: the search-hit card shape plus when it was saved. */
export type WishlistTour = SearchHit & { savedAt: string };

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const wishlistApi = {
  /** Saved tour ids — used to hydrate heart states across the site. */
  ids(): Promise<string[]> {
    return call<string[]>('/wishlist/ids');
  },

  /** Full saved-tour list (newest first), localized, ready for card rendering. */
  list(locale?: Locale): Promise<WishlistTour[]> {
    const q = locale ? `?locale=${locale}` : '';
    return call<WishlistTour[]>(`/wishlist${q}`);
  },

  add(tourId: string): Promise<{ tourId: string; saved: boolean }> {
    return call(`/wishlist/${tourId}`, { method: 'POST' });
  },

  remove(tourId: string): Promise<{ tourId: string; saved: boolean }> {
    return call(`/wishlist/${tourId}`, { method: 'DELETE' });
  },
};
