import type {
  AddTourImagePayload,
  AddTourLanguagePayload,
  AdminTripsQueryParams,
  CreateTourAddOnPayload,
  CreateTourAgeBandPayload,
  CreateTourHighlightPayload,
  CreateTourInclusionPayload,
  CreateTourExclusionPayload,
  CreateTourFeaturePayload,
  CreateTourLocationPayload,
  CreatePickupLocationPayload,
  CreateTourSchedulePayload,
  CreateTourExceptionPayload,
  CreateTripPayload,
  MyTripsQueryParams,
  PaginatedTrips,
  TourAddOn,
  TourAgeBand,
  TourHighlight,
  TourImage,
  TourInclusion,
  TourExclusion,
  TourFeature,
  TourLocation,
  PickupLocation,
  TourLanguage,
  TourSchedule,
  TourException,
  TripListItem,
  TripTranslation,
  TripUpdateResponse,
  UpdateTourAddOnPayload,
  UpdateTourAgeBandPayload,
  UpdateTourHighlightPayload,
  UpdateTourImagePayload,
  UpdateTourInclusionPayload,
  UpdateTourExclusionPayload,
  UpdateTourFeaturePayload,
  UpdateTourLocationPayload,
  UpdatePickupLocationPayload,
  UpdateTourSchedulePayload,
  UpdateTripPayload,
  UpsertHighlightTranslationPayload,
  UpsertInclusionTranslationPayload,
  UpsertExclusionTranslationPayload,
  UpsertFeatureTranslationPayload,
  UpsertLocationTranslationPayload,
  UpsertPickupLocationTranslationPayload,
  UpsertTripTranslationPayload,
} from '@/types/trip';

import { apiFetch } from './fetch';

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

  // Highlights
  getHighlights(tripId: string): Promise<TourHighlight[]> {
    return apiFetch<TourHighlight[]>(`/tours/${tripId}/highlights`);
  },

  addHighlight(tripId: string, payload: CreateTourHighlightPayload): Promise<TourHighlight> {
    return apiFetch<TourHighlight>(`/tours/${tripId}/highlights`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateHighlight(tripId: string, highlightId: string, payload: UpdateTourHighlightPayload): Promise<TourHighlight> {
    return apiFetch<TourHighlight>(`/tours/${tripId}/highlights/${highlightId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  removeHighlight(tripId: string, highlightId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/highlights/${highlightId}`, { method: 'DELETE' });
  },

  upsertHighlightTranslation(
    tripId: string,
    highlightId: string,
    locale: string,
    payload: UpsertHighlightTranslationPayload
  ): Promise<TourHighlight> {
    return apiFetch<TourHighlight>(`/tours/${tripId}/highlights/${highlightId}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteHighlightTranslation(tripId: string, highlightId: string, locale: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${tripId}/highlights/${highlightId}/translations/${locale}`, {
      method: 'DELETE',
    });
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

  removeSchedule(scheduleId: string): Promise<void> {
    return apiFetch<void>(`/availability/schedules/${scheduleId}`, { method: 'DELETE' });
  },

  // Exceptions (availability module - date-specific overrides keyed by tourId)
  getExceptions(tripId: string): Promise<TourException[]> {
    return apiFetch<TourException[]>(`/availability/exceptions${buildQuery({ tourId: tripId })}`);
  },

  createException(tripId: string, payload: CreateTourExceptionPayload): Promise<TourException> {
    return apiFetch<TourException>(`/availability/exceptions`, {
      method: 'POST',
      body: JSON.stringify({ tourId: tripId, ...payload }),
    });
  },

  removeException(exceptionId: string): Promise<void> {
    return apiFetch<void>(`/availability/exceptions/${exceptionId}`, { method: 'DELETE' });
  },
};
