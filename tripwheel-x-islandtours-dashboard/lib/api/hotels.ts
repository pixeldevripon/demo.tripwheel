import type { Locale } from '@/lib/constants/locales';
import type {
  CreateHotelPayload,
  Hotel,
  HotelTranslation,
  UpdateHotelPayload,
  UpsertHotelTranslationPayload,
} from '@/types/hotel';
import { apiFetch } from './fetch';

/**
 * Island Tours' own hotels (the thank-you page promo). All endpoints require
 * MANAGE_EDITORIAL (admin-only) - they advertise OUR property on a page that
 * follows an operator's booking, so operators must never reach them.
 *
 * Every path starts with `hotels/`, which is what makes `apiFetch`'s path-based
 * public-cache busting map every write here to the `hotels` tag with no extra
 * wiring - the AI-translation generate route included.
 */
export const hotelsApi = {
  list(): Promise<Hotel[]> {
    return apiFetch<Hotel[]>('/hotels');
  },

  get(id: string): Promise<Hotel> {
    return apiFetch<Hotel>(`/hotels/${id}`);
  },

  create(payload: CreateHotelPayload): Promise<Hotel> {
    return apiFetch<Hotel>('/hotels', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateHotelPayload): Promise<Hotel> {
    return apiFetch<Hotel>(`/hotels/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /** 403 on a seeded hotel - the UI disables the action, this is the backstop. */
  remove(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hotels/${id}`, { method: 'DELETE' });
  },

  getTranslations(id: string): Promise<HotelTranslation[]> {
    return apiFetch<HotelTranslation[]>(`/hotels/${id}/translations`);
  },

  upsertTranslation(
    id: string,
    locale: Locale,
    payload: UpsertHotelTranslationPayload,
  ): Promise<HotelTranslation> {
    return apiFetch<HotelTranslation>(`/hotels/${id}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
