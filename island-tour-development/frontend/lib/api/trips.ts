import type {
  AddTourImagePayload,
  AddTourLanguagePayload,
  AdminTripsQueryParams,
  CreateTourAddOnPayload,
  CreateTourAgeBandPayload,
  CreateTourHighlightPayload,
  CreateTourInclusionPayload,
  CreateTourExclusionPayload,
  CreateTourSchedulePayload,
  CreateTripPayload,
  MyTripsQueryParams,
  PaginatedTrips,
  TourAddOn,
  TourAgeBand,
  TourHighlight,
  TourImage,
  TourInclusion,
  TourExclusion,
  TourLanguage,
  TourSchedule,
  TripListItem,
  TripTranslation,
  TripUpdateResponse,
  UpdateTourAddOnPayload,
  UpdateTourAgeBandPayload,
  UpdateTourHighlightPayload,
  UpdateTourImagePayload,
  UpdateTourInclusionPayload,
  UpdateTourExclusionPayload,
  UpdateTourSchedulePayload,
  UpdateTripPayload,
  UpsertHighlightTranslationPayload,
  UpsertInclusionTranslationPayload,
  UpsertExclusionTranslationPayload,
  UpsertTripTranslationPayload,
} from '@/types/trip';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
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
      // ignore json parse error
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const tripsApi = {
  // Core trip endpoints
  getMyTrips(params: MyTripsQueryParams = {}): Promise<PaginatedTrips> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
    return apiFetch<PaginatedTrips>(`/trips/my-trips${query}`);
  },

  getAdminTrips(params: AdminTripsQueryParams = {}): Promise<PaginatedTrips> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
    return apiFetch<PaginatedTrips>(`/trips/admin/all${query}`);
  },

  getById(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/trips/${id}`);
  },

  create(payload: CreateTripPayload): Promise<TripListItem> {
    return apiFetch<TripListItem>('/trips', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateTripPayload): Promise<TripUpdateResponse> {
    return apiFetch<TripUpdateResponse>(`/trips/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  publish(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/trips/${id}/publish`, { method: 'POST' });
  },

  pause(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/trips/${id}/pause`, { method: 'POST' });
  },

  unpause(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/trips/${id}/unpause`, { method: 'POST' });
  },

  archive(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/trips/${id}/archive`, { method: 'POST' });
  },

  restore(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/trips/${id}/restore`, { method: 'POST' });
  },

  remove(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${id}`, { method: 'DELETE' });
  },

  // Images
  getImages(tripId: string): Promise<TourImage[]> {
    return apiFetch<TourImage[]>(`/trips/${tripId}/images`);
  },

  addImage(tripId: string, payload: AddTourImagePayload): Promise<TourImage> {
    return apiFetch<TourImage>(`/trips/${tripId}/images`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateImage(tripId: string, imageId: string, payload: UpdateTourImagePayload): Promise<TourImage> {
    return apiFetch<TourImage>(`/trips/${tripId}/images/${imageId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeImage(tripId: string, imageId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/images/${imageId}`, { method: 'DELETE' });
  },

  // Age Bands
  getAgeBands(tripId: string): Promise<TourAgeBand[]> {
    return apiFetch<TourAgeBand[]>(`/trips/${tripId}/age-bands`);
  },

  createAgeBand(tripId: string, payload: CreateTourAgeBandPayload): Promise<TourAgeBand> {
    return apiFetch<TourAgeBand>(`/trips/${tripId}/age-bands`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAgeBand(tripId: string, bandId: string, payload: UpdateTourAgeBandPayload): Promise<TourAgeBand> {
    return apiFetch<TourAgeBand>(`/trips/${tripId}/age-bands/${bandId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeAgeBand(tripId: string, bandId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/age-bands/${bandId}`, { method: 'DELETE' });
  },

  // Add-Ons
  getAddOns(tripId: string): Promise<TourAddOn[]> {
    return apiFetch<TourAddOn[]>(`/trips/${tripId}/addons`);
  },

  createAddOn(tripId: string, payload: CreateTourAddOnPayload): Promise<TourAddOn> {
    return apiFetch<TourAddOn>(`/trips/${tripId}/addons`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAddOn(tripId: string, addOnId: string, payload: UpdateTourAddOnPayload): Promise<TourAddOn> {
    return apiFetch<TourAddOn>(`/trips/${tripId}/addons/${addOnId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeAddOn(tripId: string, addOnId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/addons/${addOnId}`, { method: 'DELETE' });
  },

  // Languages
  getLanguages(tripId: string): Promise<TourLanguage[]> {
    return apiFetch<TourLanguage[]>(`/trips/${tripId}/languages`);
  },

  addLanguage(tripId: string, payload: AddTourLanguagePayload): Promise<TourLanguage> {
    return apiFetch<TourLanguage>(`/trips/${tripId}/languages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  removeLanguage(tripId: string, languageId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/languages/${languageId}`, { method: 'DELETE' });
  },

  // Highlights
  getHighlights(tripId: string): Promise<TourHighlight[]> {
    return apiFetch<TourHighlight[]>(`/trips/${tripId}/highlights`);
  },

  addHighlight(tripId: string, payload: CreateTourHighlightPayload): Promise<TourHighlight> {
    return apiFetch<TourHighlight>(`/trips/${tripId}/highlights`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateHighlight(tripId: string, highlightId: string, payload: UpdateTourHighlightPayload): Promise<TourHighlight> {
    return apiFetch<TourHighlight>(`/trips/${tripId}/highlights/${highlightId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeHighlight(tripId: string, highlightId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/highlights/${highlightId}`, { method: 'DELETE' });
  },

  upsertHighlightTranslation(
    tripId: string,
    highlightId: string,
    locale: string,
    payload: UpsertHighlightTranslationPayload
  ): Promise<TourHighlight> {
    return apiFetch<TourHighlight>(`/trips/${tripId}/highlights/${highlightId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteHighlightTranslation(tripId: string, highlightId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/highlights/${highlightId}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  // Inclusions
  getInclusions(tripId: string): Promise<TourInclusion[]> {
    return apiFetch<TourInclusion[]>(`/trips/${tripId}/inclusions`);
  },

  addInclusion(tripId: string, payload: CreateTourInclusionPayload): Promise<TourInclusion> {
    return apiFetch<TourInclusion>(`/trips/${tripId}/inclusions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateInclusion(tripId: string, inclusionId: string, payload: UpdateTourInclusionPayload): Promise<TourInclusion> {
    return apiFetch<TourInclusion>(`/trips/${tripId}/inclusions/${inclusionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeInclusion(tripId: string, inclusionId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/inclusions/${inclusionId}`, { method: 'DELETE' });
  },

  upsertInclusionTranslation(
    tripId: string,
    inclusionId: string,
    locale: string,
    payload: UpsertInclusionTranslationPayload
  ): Promise<TourInclusion> {
    return apiFetch<TourInclusion>(`/trips/${tripId}/inclusions/${inclusionId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteInclusionTranslation(tripId: string, inclusionId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/inclusions/${inclusionId}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  // Exclusions
  getExclusions(tripId: string): Promise<TourExclusion[]> {
    return apiFetch<TourExclusion[]>(`/trips/${tripId}/exclusions`);
  },

  addExclusion(tripId: string, payload: CreateTourExclusionPayload): Promise<TourExclusion> {
    return apiFetch<TourExclusion>(`/trips/${tripId}/exclusions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateExclusion(tripId: string, exclusionId: string, payload: UpdateTourExclusionPayload): Promise<TourExclusion> {
    return apiFetch<TourExclusion>(`/trips/${tripId}/exclusions/${exclusionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeExclusion(tripId: string, exclusionId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/exclusions/${exclusionId}`, { method: 'DELETE' });
  },

  upsertExclusionTranslation(
    tripId: string,
    exclusionId: string,
    locale: string,
    payload: UpsertExclusionTranslationPayload
  ): Promise<TourExclusion> {
    return apiFetch<TourExclusion>(`/trips/${tripId}/exclusions/${exclusionId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteExclusionTranslation(tripId: string, exclusionId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/exclusions/${exclusionId}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  // Translations
  getTranslations(tripId: string): Promise<TripTranslation[]> {
    return apiFetch<TripTranslation[]>(`/trips/${tripId}/translations`);
  },

  getTranslationByLocale(tripId: string, locale: string): Promise<TripTranslation> {
    return apiFetch<TripTranslation>(`/trips/${tripId}/translations/${locale}`);
  },

  upsertTranslation(tripId: string, locale: string, payload: UpsertTripTranslationPayload): Promise<TripTranslation> {
    return apiFetch<TripTranslation>(`/trips/${tripId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteTranslation(tripId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/translations/${locale}`, { method: 'DELETE' });
  },

  // Schedules
  getSchedules(tripId: string): Promise<TourSchedule[]> {
    return apiFetch<TourSchedule[]>(`/trips/${tripId}/schedules`);
  },

  createSchedule(tripId: string, payload: CreateTourSchedulePayload): Promise<TourSchedule> {
    return apiFetch<TourSchedule>(`/trips/${tripId}/schedules`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateSchedule(tripId: string, scheduleId: string, payload: UpdateTourSchedulePayload): Promise<TourSchedule> {
    return apiFetch<TourSchedule>(`/trips/${tripId}/schedules/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeSchedule(tripId: string, scheduleId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/trips/${tripId}/schedules/${scheduleId}`, { method: 'DELETE' });
  },
};
