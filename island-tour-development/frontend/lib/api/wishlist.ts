/**
 * Client-side wishlist API for the COOKIE-BASED wishlist (no login).
 *
 * The browser owns the saved set (`it.wishlist` cookie, 6 months); the backend
 * only resolves ids into card-ready tours via the public
 * `GET /wishlist/resolve` endpoint. Always fetched in the browser - the list
 * is personal, so it is never part of the cached server shell.
 */
import type { Currency, Locale } from '@/lib/constants/locales';
import type { SearchHit } from '@/types/search';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/** A saved tour: the search-hit card shape (badge/isSponsored absent here). */
export type WishlistTour = Omit<SearchHit, 'badge' | 'isSponsored'> &
  Partial<Pick<SearchHit, 'badge' | 'isSponsored'>>;

export const wishlistApi = {
  /**
   * Resolve cookie-saved tour ids into card-ready tours (order preserved,
   * stale ids silently dropped by the backend). Returns `[]` for no ids.
   */
  async resolve(
    ids: string[],
    locale?: Locale,
    currency?: Currency,
  ): Promise<WishlistTour[]> {
    if (ids.length === 0) return [];
    const qs = new URLSearchParams({ ids: ids.join(',') });
    if (locale) qs.set('locale', locale);
    if (currency) qs.set('currency', currency);

    const res = await fetch(`${BACKEND_API_BASE}/wishlist/resolve?${qs.toString()}`);
    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      try {
        const body = await res.json();
        if (body?.message)
          message = Array.isArray(body.message)
            ? body.message.join(', ')
            : body.message;
      } catch {
        // ignore
      }
      throw new Error(message);
    }
    return res.json() as Promise<WishlistTour[]>;
  },
};
