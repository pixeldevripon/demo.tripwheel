/**
 * Client-side wishlist API for the COOKIE-BASED wishlist (no login).
 *
 * The browser owns the saved set (`it.wishlist` cookie, 6 months); the backend
 * resolves ids into card-ready tours, answers "can I book these on this day?"
 * for the date check, and mails a list back to its owner. Always fetched in the
 * browser - the list is personal, so it is never part of the cached server
 * shell.
 */
import type { Currency, Locale } from '@/lib/constants/locales';
import type { SearchHit } from '@/types/search';
import { BACKEND_API_BASE } from '@/lib/api/backend-url';

/**
 * A saved tour that can still be booked: the full search-hit card shape.
 *
 * `badge`/`isSponsored` used to be absent - the resolve endpoint never fetched
 * the inputs, so saved cards rendered an empty badge slot while the same tour
 * showed "Most popular" everywhere else. The backend now derives them (and
 * applies the §3.6 per-category cap across the resolved list), minus the
 * Sponsored badge, which mck-17 bars from this grid: nothing here was placed
 * by us.
 */
export type BookableSavedTour = SearchHit & { isBookable: true };

/**
 * A saved tour that has stopped being sellable - unpublished, archived or
 * deactivated since it was saved.
 *
 * Carries only what the dimmed tile draws. There is no price, no badge and no
 * detail URL because the backend does not send them: the card is not clickable
 * and a non-LIVE tour's commercial data has no place in a public payload.
 */
export type UnbookableSavedTour = {
  id: string;
  title: string;
  images: { url: string; altText: string | null }[];
  destinationSlug: string | null;
  /** Where to look for something like it, when the tour had a category. */
  primaryCategorySlug: string | null;
  isBookable: false;
};

export type SavedTourCard = BookableSavedTour | UnbookableSavedTour;

/** Narrowing helper - the union is discriminated, this just reads better. */
export function isBookable(card: SavedTourCard): card is BookableSavedTour {
  return card.isBookable;
}

/** Per-tour answer from the date check. */
export type AvailabilityAnswer = { tourId: string; available: boolean };

export type AvailabilityBatch = {
  date: string;
  guests: number;
  tours: AvailabilityAnswer[];
};

async function readError(res: Response): Promise<string> {
  let message = `Request failed with status ${res.status}`;
  try {
    const body = await res.json();
    if (body?.message) {
      message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    }
  } catch {
    // A non-JSON error body tells us nothing the status has not already said.
  }
  return message;
}

export const wishlistApi = {
  /**
   * Resolve cookie-saved tour ids into card-ready tours (order preserved).
   * Returns `[]` for no ids. Tours that can no longer be booked come back with
   * `isBookable: false` rather than disappearing.
   */
  async resolve(
    ids: string[],
    locale?: Locale,
    currency?: Currency,
  ): Promise<SavedTourCard[]> {
    if (ids.length === 0) return [];
    const qs = new URLSearchParams({ ids: ids.join(',') });
    if (locale) qs.set('locale', locale);
    if (currency) qs.set('currency', currency);

    const res = await fetch(`${BACKEND_API_BASE}/wishlist/resolve?${qs.toString()}`);
    if (!res.ok) throw new Error(await readError(res));
    return res.json() as Promise<SavedTourCard[]>;
  },

  /**
   * "Can I book each of these on this day?" - one call for the whole list, so
   * a page of twenty saved tours does not fire twenty requests to colour
   * twenty chips.
   */
  async checkDate(
    tourIds: string[],
    date: string,
    guests: number,
  ): Promise<AvailabilityBatch> {
    const res = await fetch(`${BACKEND_API_BASE}/availability/check-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tourIds, date, guests }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return res.json() as Promise<AvailabilityBatch>;
  },

  /**
   * Mail the list back to its owner. The address is used for this send and is
   * not stored anywhere - there is no subscriber list on the platform to join.
   */
  async emailList(
    email: string,
    ids: string[],
    locale?: Locale,
    currency?: Currency,
  ): Promise<{ sent: number }> {
    const res = await fetch(`${BACKEND_API_BASE}/wishlist/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ids: ids.join(','), locale, currency }),
    });
    if (!res.ok) throw new Error(await readError(res));
    return res.json() as Promise<{ sent: number }>;
  },
};
