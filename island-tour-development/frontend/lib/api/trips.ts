import type {
  AddTourImagePayload,
  AddTourLanguagePayload,
  AdminTripsQueryParams,
  CreateTourAddOnPayload,
  CreateTourAgeBandPayload,
  CreateTourInclusionPayload,
  CreateTourExclusionPayload,
  CreateTourFeaturePayload,
  CreateTourLocationPayload,
  CreatePickupLocationPayload,
  CreateTourSchedulePayload,
  CreateTripPayload,
  MyTripsQueryParams,
  PaginatedTrips,
  TourAddOn,
  TourAgeBand,
  TourImage,
  TourInclusion,
  TourExclusion,
  TourFeature,
  TourLocation,
  PickupLocation,
  TourLanguage,
  TourSchedule,
  TripListItem,
  TripTranslation,
  TripUpdateResponse,
  UpdateTourAddOnPayload,
  UpdateTourAgeBandPayload,
  UpdateTourImagePayload,
  UpdateTourInclusionPayload,
  UpdateTourExclusionPayload,
  UpdateTourFeaturePayload,
  UpdateTourLocationPayload,
  UpdatePickupLocationPayload,
  UpdateTourSchedulePayload,
  UpdateTripPayload,
  UpsertInclusionTranslationPayload,
  UpsertExclusionTranslationPayload,
  UpsertFeatureTranslationPayload,
  UpsertLocationTranslationPayload,
  UpsertPickupLocationTranslationPayload,
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

// Backend route base for the tour CRUD surface is `/tours` (+ `/tours/:tourId/...`
// for content children). Schedules live in the availability module at `/availability`.
export const tripsApi = {
  // Core tour endpoints
  getMyTrips(params: MyTripsQueryParams = {}): Promise<PaginatedTrips> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
    return apiFetch<PaginatedTrips>(`/tours/my-tours${query}`);
  },

  getAdminTrips(params: AdminTripsQueryParams = {}): Promise<PaginatedTrips> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
    return apiFetch<PaginatedTrips>(`/tours/admin/all${query}`);
  },

  getById(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}`);
  },

  create(payload: CreateTripPayload): Promise<TripListItem> {
    return apiFetch<TripListItem>('/tours', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateTripPayload): Promise<TripUpdateResponse> {
    return apiFetch<TripUpdateResponse>(`/tours/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  publish(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}/publish`, { method: 'POST' });
  },

  pause(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}/pause`, { method: 'POST' });
  },

  unpause(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}/unpause`, { method: 'POST' });
  },

  archive(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}/archive`, { method: 'POST' });
  },

  restore(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}/restore`, { method: 'POST' });
  },

  remove(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${id}`, { method: 'DELETE' });
  },

  // Images
  getImages(tripId: string): Promise<TourImage[]> {
    return apiFetch<TourImage[]>(`/tours/${tripId}/images`);
  },

  addImage(tripId: string, payload: AddTourImagePayload): Promise<TourImage> {
    return apiFetch<TourImage>(`/tours/${tripId}/images`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateImage(tripId: string, imageId: string, payload: UpdateTourImagePayload): Promise<TourImage> {
    return apiFetch<TourImage>(`/tours/${tripId}/images/${imageId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeImage(tripId: string, imageId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/images/${imageId}`, { method: 'DELETE' });
  },

  // Add-Ons
  getAddOns(tripId: string): Promise<TourAddOn[]> {
    return apiFetch<TourAddOn[]>(`/tours/${tripId}/addons`);
  },

  createAddOn(tripId: string, payload: CreateTourAddOnPayload): Promise<TourAddOn> {
    return apiFetch<TourAddOn>(`/tours/${tripId}/addons`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAddOn(tripId: string, addOnId: string, payload: UpdateTourAddOnPayload): Promise<TourAddOn> {
    return apiFetch<TourAddOn>(`/tours/${tripId}/addons/${addOnId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeAddOn(tripId: string, addOnId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/addons/${addOnId}`, { method: 'DELETE' });
  },

  // Age Bands
  getAgeBands(tripId: string): Promise<TourAgeBand[]> {
    return apiFetch<TourAgeBand[]>(`/tours/${tripId}/age-bands`);
  },

  createAgeBand(tripId: string, payload: CreateTourAgeBandPayload): Promise<TourAgeBand> {
    return apiFetch<TourAgeBand>(`/tours/${tripId}/age-bands`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateAgeBand(tripId: string, ageBandId: string, payload: UpdateTourAgeBandPayload): Promise<TourAgeBand> {
    return apiFetch<TourAgeBand>(`/tours/${tripId}/age-bands/${ageBandId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeAgeBand(tripId: string, ageBandId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/age-bands/${ageBandId}`, { method: 'DELETE' });
  },

  // Languages
  getLanguages(tripId: string): Promise<TourLanguage[]> {
    return apiFetch<TourLanguage[]>(`/tours/${tripId}/languages`);
  },

  addLanguage(tripId: string, payload: AddTourLanguagePayload): Promise<TourLanguage> {
    return apiFetch<TourLanguage>(`/tours/${tripId}/languages`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  removeLanguage(tripId: string, languageId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/languages/${languageId}`, { method: 'DELETE' });
  },

  // Inclusions
  getInclusions(tripId: string): Promise<TourInclusion[]> {
    return apiFetch<TourInclusion[]>(`/tours/${tripId}/inclusions`);
  },

  addInclusion(tripId: string, payload: CreateTourInclusionPayload): Promise<TourInclusion> {
    return apiFetch<TourInclusion>(`/tours/${tripId}/inclusions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateInclusion(tripId: string, inclusionId: string, payload: UpdateTourInclusionPayload): Promise<TourInclusion> {
    return apiFetch<TourInclusion>(`/tours/${tripId}/inclusions/${inclusionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeInclusion(tripId: string, inclusionId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/inclusions/${inclusionId}`, { method: 'DELETE' });
  },

  upsertInclusionTranslation(
    tripId: string,
    inclusionId: string,
    locale: string,
    payload: UpsertInclusionTranslationPayload
  ): Promise<TourInclusion> {
    return apiFetch<TourInclusion>(`/tours/${tripId}/inclusions/${inclusionId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteInclusionTranslation(tripId: string, inclusionId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/inclusions/${inclusionId}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  // Exclusions
  getExclusions(tripId: string): Promise<TourExclusion[]> {
    return apiFetch<TourExclusion[]>(`/tours/${tripId}/exclusions`);
  },

  addExclusion(tripId: string, payload: CreateTourExclusionPayload): Promise<TourExclusion> {
    return apiFetch<TourExclusion>(`/tours/${tripId}/exclusions`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateExclusion(tripId: string, exclusionId: string, payload: UpdateTourExclusionPayload): Promise<TourExclusion> {
    return apiFetch<TourExclusion>(`/tours/${tripId}/exclusions/${exclusionId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeExclusion(tripId: string, exclusionId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/exclusions/${exclusionId}`, { method: 'DELETE' });
  },

  upsertExclusionTranslation(
    tripId: string,
    exclusionId: string,
    locale: string,
    payload: UpsertExclusionTranslationPayload
  ): Promise<TourExclusion> {
    return apiFetch<TourExclusion>(`/tours/${tripId}/exclusions/${exclusionId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteExclusionTranslation(tripId: string, exclusionId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/exclusions/${exclusionId}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  // Features (terms, pre-booking / pre-arrival info, redemption, accessibility, additional info)
  getFeatures(tripId: string): Promise<TourFeature[]> {
    return apiFetch<TourFeature[]>(`/tours/${tripId}/features`);
  },

  addFeature(tripId: string, payload: CreateTourFeaturePayload): Promise<TourFeature> {
    return apiFetch<TourFeature>(`/tours/${tripId}/features`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateFeature(tripId: string, featureId: string, payload: UpdateTourFeaturePayload): Promise<TourFeature> {
    return apiFetch<TourFeature>(`/tours/${tripId}/features/${featureId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeFeature(tripId: string, featureId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/features/${featureId}`, { method: 'DELETE' });
  },

  upsertFeatureTranslation(
    tripId: string,
    featureId: string,
    locale: string,
    payload: UpsertFeatureTranslationPayload
  ): Promise<TourFeature> {
    return apiFetch<TourFeature>(`/tours/${tripId}/features/${featureId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteFeatureTranslation(tripId: string, featureId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/features/${featureId}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  // Locations (itinerary: start / itinerary item / end / point of interest)
  getLocations(tripId: string): Promise<TourLocation[]> {
    return apiFetch<TourLocation[]>(`/tours/${tripId}/locations`);
  },

  addLocation(tripId: string, payload: CreateTourLocationPayload): Promise<TourLocation> {
    return apiFetch<TourLocation>(`/tours/${tripId}/locations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateLocation(tripId: string, locationId: string, payload: UpdateTourLocationPayload): Promise<TourLocation> {
    return apiFetch<TourLocation>(`/tours/${tripId}/locations/${locationId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeLocation(tripId: string, locationId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/locations/${locationId}`, { method: 'DELETE' });
  },

  upsertLocationTranslation(
    tripId: string,
    locationId: string,
    locale: string,
    payload: UpsertLocationTranslationPayload
  ): Promise<TourLocation> {
    return apiFetch<TourLocation>(`/tours/${tripId}/locations/${locationId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteLocationTranslation(tripId: string, locationId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/locations/${locationId}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  // Pickup locations
  getPickupLocations(tripId: string): Promise<PickupLocation[]> {
    return apiFetch<PickupLocation[]>(`/tours/${tripId}/pickup-locations`);
  },

  addPickupLocation(tripId: string, payload: CreatePickupLocationPayload): Promise<PickupLocation> {
    return apiFetch<PickupLocation>(`/tours/${tripId}/pickup-locations`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updatePickupLocation(
    tripId: string,
    pickupLocationId: string,
    payload: UpdatePickupLocationPayload
  ): Promise<PickupLocation> {
    return apiFetch<PickupLocation>(`/tours/${tripId}/pickup-locations/${pickupLocationId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removePickupLocation(tripId: string, pickupLocationId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/pickup-locations/${pickupLocationId}`, { method: 'DELETE' });
  },

  upsertPickupLocationTranslation(
    tripId: string,
    pickupLocationId: string,
    locale: string,
    payload: UpsertPickupLocationTranslationPayload
  ): Promise<PickupLocation> {
    return apiFetch<PickupLocation>(`/tours/${tripId}/pickup-locations/${pickupLocationId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deletePickupLocationTranslation(
    tripId: string,
    pickupLocationId: string,
    locale: string
  ): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/pickup-locations/${pickupLocationId}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  // Translations
  getTranslations(tripId: string): Promise<TripTranslation[]> {
    return apiFetch<TripTranslation[]>(`/tours/${tripId}/translations`);
  },

  getTranslationByLocale(tripId: string, locale: string): Promise<TripTranslation> {
    return apiFetch<TripTranslation>(`/tours/${tripId}/translations/${locale}`);
  },

  upsertTranslation(tripId: string, locale: string, payload: UpsertTripTranslationPayload): Promise<TripTranslation> {
    return apiFetch<TripTranslation>(`/tours/${tripId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteTranslation(tripId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/translations/${locale}`, { method: 'DELETE' });
  },

  // Schedules (availability module - recurring weekly schedules keyed by tourId)
  getSchedules(tripId: string): Promise<TourSchedule[]> {
    return apiFetch<TourSchedule[]>(`/availability/schedules${buildQuery({ tourId: tripId })}`);
  },

  createSchedule(tripId: string, payload: CreateTourSchedulePayload): Promise<TourSchedule> {
    return apiFetch<TourSchedule>(`/availability/schedules`, {
      method: 'POST',
      body: JSON.stringify({ tourId: tripId, ...payload }),
    });
  },

  updateSchedule(scheduleId: string, payload: UpdateTourSchedulePayload): Promise<TourSchedule> {
    return apiFetch<TourSchedule>(`/availability/schedules/${scheduleId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeSchedule(scheduleId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/availability/schedules/${scheduleId}`, { method: 'DELETE' });
  },
};
