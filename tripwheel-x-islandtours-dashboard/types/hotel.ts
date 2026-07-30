/**
 * Island Tours' own hotels - mirrors the backend DTOs
 * (`src/hotels/dto/hotel.dto.ts`).
 *
 * A LIST that feeds ONE card: the thank-you page renders a single promo, so the
 * public read serves the first enabled, COMPLETE hotel by `displayOrder`. Holding
 * several rows is about swapping which property is promoted - and keeping the
 * retired one's copy - without retyping it every season.
 *
 * THE FALLBACK RULE IS NOT THE HOMEPAGE'S. There, a blank field renders the copy
 * the site ships with. Here there is no bundled hotel: clearing the photo, the
 * English title or the booking link takes that hotel out of the running, and the
 * card passes to the next one (or disappears). Only the two chrome labels
 * (eyebrow, CTA text) behave the homepage way and fall back to the site's own
 * translated defaults.
 */

import type { Locale } from '@/types/locale';

/** The only currencies the platform prices in. */
export type HotelCurrency = 'USD' | 'EUR';

/** Per-locale hotel copy. */
export interface HotelTranslation {
  locale: Locale;
  /** Null = the site keeps its own translated "OUR APARTMENT" label. */
  eyebrow: string | null;
  areaLabel: string | null;
  title: string | null;
  /** One line per paragraph on the card. */
  description: string | null;
  /** Null = the site keeps its own translated "See availability" label. */
  ctaLabel: string | null;
  isMachineTranslated: boolean;
}

/** One hotel as the dashboard sees it. */
export interface Hotel {
  id: string;
  /** Whether this hotel may be promoted at all. */
  isEnabled: boolean;
  /** Promotion priority - the lowest enabled, complete hotel takes the card. */
  displayOrder: number;
  /**
   * Seeded hotels cannot be deleted (the API answers 403), the same protection
   * seeded destinations have. It guarantees the promo always has one occupant,
   * so the section can only be emptied deliberately, by switching hotels off.
   */
  isSeeded: boolean;
  imageUrl: string | null;
  bookingUrl: string | null;
  /** Out of 5, one decimal place. */
  rating: number | null;
  reviewCount: number | null;
  sleeps: number | null;
  pricePerNight: number | null;
  currency: HotelCurrency;
  /**
   * Whether THIS hotel is the one on the public site right now - decided across
   * the whole list, since exactly one is promoted. Surfaced because the failure
   * mode is silent: a hotel with no booking link simply never appears, and an
   * admin has no other way to find that out.
   */
  isPromoted: boolean;
  /** Whether it COULD be promoted: the render gate, minus the on/off switch. */
  isComplete: boolean;
  translations: HotelTranslation[];
}

/** PATCH /hotels/:id - only the named fields are touched; null clears one. */
export interface UpdateHotelPayload {
  isEnabled?: boolean;
  displayOrder?: number;
  imageUrl?: string | null;
  bookingUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  sleeps?: number | null;
  pricePerNight?: number | null;
  currency?: HotelCurrency;
}

/**
 * POST /hotels - the record plus its English copy, written together.
 *
 * `title` is the only required field. It is both the render gate and the label
 * the list shows, so a hotel without one is a row nobody can identify. Everything
 * else can be filled in afterwards - a new hotel is expected to sit incomplete,
 * and therefore unpromoted, while it is being written.
 */
export interface CreateHotelPayload extends UpdateHotelPayload {
  title: string;
  areaLabel?: string | null;
  description?: string | null;
  eyebrow?: string | null;
  ctaLabel?: string | null;
}

/** Copy fields, wrapped exactly like every other translatable entity. */
export type HotelTranslationFields = Partial<
  Omit<HotelTranslation, 'locale' | 'isMachineTranslated'>
>;

export interface UpsertHotelTranslationPayload {
  fields: HotelTranslationFields;
  isMachineTranslated?: boolean;
}

/** The English title, or a placeholder - what the list and console label a row by. */
export function hotelName(hotel: Hotel): string {
  const en = hotel.translations.find((t) => t.locale === 'en');
  return en?.title?.trim() || '(untitled)';
}
