import type {
  LocalsFavouriteStats,
  SetLocalsFavouriteResponse,
} from '@/types/locals-favourite';

import { apiFetch } from './fetch';

// Editorial curation surface (admin-only). The candidate tour list is fetched
// through the existing admin tours query (`tripsApi.getAdminTrips`, filtered by
// destination) — this module only owns the toggle + coverage stats.
export const localsFavouritesApi = {
  getStats(): Promise<LocalsFavouriteStats> {
    return apiFetch<LocalsFavouriteStats>('/tours/admin/locals-favourite/stats');
  },

  setForTour(tourId: string, value: boolean): Promise<SetLocalsFavouriteResponse> {
    return apiFetch<SetLocalsFavouriteResponse>(`/tours/${tourId}/locals-favourite`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
  },
};
