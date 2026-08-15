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
  AgendaResponse,
  AvailabilityOverviewParams,
  AvailabilityOverviewResponse,
  AvailabilitySummary,
  DepartureStatus,
  ManageCalendarDay,
  RangeImpact,
  RangeScopeParams,
  TourDeparture,
  CreateTripPayload,
  MyTripsQueryParams,
  PaginatedPendingChanges,
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
  TourClosureReason,
  TripListItem,
  TripPendingChange,
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

  /** Operator submits a DRAFT for platform review (conflict #1). */
  submitForReview(id: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}/submit-for-review`, {
      method: 'POST',
    });
  },

  /** Admin approves a PENDING submission (publish stays a separate step). */
  approve(id: string, note?: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify(note?.trim() ? { note } : {}),
    });
  },

  /** Admin rejects a PENDING submission with a required actionable note. */
  reject(id: string, note: string): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
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

  /**
   * Demand-badge override. Its own MANAGE_EDITORIAL verb rather than a key on
   * PATCH /tours/:id - "Likely to sell out" is an EARNED scarcity signal, so
   * the 2026-08-02 audit took `likelyToSellOutOverride` out of UpdateTourDto
   * to stop an operator manufacturing urgency on their own listing.
   * `null` defers to the nightly computed signal.
   */
  setLikelyToSellOut(id: string, value: boolean | null): Promise<TripListItem> {
    return apiFetch<TripListItem>(`/tours/${id}/likely-to-sell-out`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
  },

  remove(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/tours/${id}`, { method: 'DELETE' });
  },

  // ── Live-tour pending content changes (client review #19 / dashboard #80) ──

  /** The tour's LATEST change set (open or decided) - null when none exists.
   *  Nest serialises a null return as an empty 200 body, hence the `?? null`. */
  async getPendingChange(id: string): Promise<TripPendingChange | null> {
    return (
      (await apiFetch<TripPendingChange | null>(
        `/tours/${id}/pending-changes`,
      )) ?? null
    );
  },

  /** Admin queue: open change sets across all tours, oldest submission first. */
  getPendingChanges(
    params: { page?: number; limit?: number } = {},
  ): Promise<PaginatedPendingChanges> {
    const query = buildQuery(params);
    return apiFetch<PaginatedPendingChanges>(
      `/tours/admin/pending-changes${query}`,
    );
  },

  /** Admin applies the open set to the live tour (slug untouched). */
  approvePendingChanges(id: string, note?: string): Promise<TripPendingChange> {
    return apiFetch<TripPendingChange>(`/tours/${id}/pending-changes/approve`, {
      method: 'POST',
      body: JSON.stringify(note?.trim() ? { note } : {}),
    });
  },

  /** Admin sends the open set back - live content untouched, note required. */
  rejectPendingChanges(id: string, note: string): Promise<TripPendingChange> {
    return apiFetch<TripPendingChange>(`/tours/${id}/pending-changes/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
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

  // Global calendar overview: every departure across the scoped tours,
  // day-bucketed. Operators are pinned to themselves; admins read platform-wide.
  getOverview(params: AvailabilityOverviewParams = {}): Promise<AvailabilityOverviewResponse> {
    return apiFetch<AvailabilityOverviewResponse>(
      `/availability/overview${buildQuery({ ...params })}`
    );
  },

  // Daily agenda (Surface B): every departure across the operator's tours.
  getAgenda(params?: { from?: string; days?: number }): Promise<AgendaResponse> {
    return apiFetch<AgendaResponse>(`/availability/agenda${buildQuery(params ?? {})}`);
  },

  // "Close all of today" - one CLOSE_DATE per open tour on the date. The
  // reason rides the write (MCK-16 change 1) so the register and traveller
  // calendar read the right word on every affected tour.
  async closeAgendaDay(payload: {
    date: string;
    tourId?: string;
    note?: string;
    closureReason?: TourClosureReason;
  }): Promise<{ closed: number; tourIds: string[] }> {
    try {
      return await apiFetch<{ closed: number; tourIds: string[] }>(
        `/availability/agenda/close-day`,
        { method: 'POST', body: JSON.stringify(payload) }
      );
    } catch (err) {
      // Deploy window: an older backend whitelists no closureReason on this
      // route and forbidNonWhitelisted 400s the WHOLE write (the isActive
      // postmortem). The close must still land - retry once without the
      // reason; those closures read as a plain "Closed" until the backend
      // ships. Safe to retry: the 400 was rejected before any write.
      if (
        payload.closureReason !== undefined &&
        err instanceof Error &&
        err.message.includes('closureReason')
      ) {
        const { closureReason: _dropped, ...legacy } = payload;
        return apiFetch<{ closed: number; tourIds: string[] }>(
          `/availability/agenda/close-day`,
          { method: 'POST', body: JSON.stringify(legacy) }
        );
      }
      throw err;
    }
  },

  // Freshness confirm (F14): stamps availability_confirmed_at - one tour with
  // tripId, every tour of the operator without.
  confirmAvailability(
    tripId?: string
  ): Promise<{ confirmed: number; confirmedAt: string }> {
    return apiFetch<{ confirmed: number; confirmedAt: string }>(
      `/availability/confirm`,
      {
        method: 'POST',
        body: JSON.stringify(tripId ? { tourId: tripId } : {}),
      }
    );
  },

  // Bulk blackout (F8): one CLOSE_DATE per date in [from, to], one call.
  // closureReason rides every close (MCK-16 change 1) so the register and the
  // traveller calendar read the right word on every date in the range.
  // tourId omitted = every active tour of the operator (the weather-day 'All
  // tours' scope, MCK-16 §4); an admin acting without a tourId passes
  // operatorId instead. tourCount is optional during the deploy window.
  closeRange(payload: RangeScopeParams & {
    note?: string;
    closureReason?: TourClosureReason;
  }): Promise<{ closed: number; tourCount?: number }> {
    return apiFetch<{ closed: number; tourCount?: number }>(
      `/availability/exceptions/close-range`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  // The one-unit Undo of closeRange (retires every whole-day closure in
  // range). Scoped exactly like closeRange.
  reopenRange(
    payload: RangeScopeParams,
  ): Promise<{ reopened: number; tourCount?: number }> {
    return apiFetch<{ reopened: number; tourCount?: number }>(
      `/availability/exceptions/reopen-range`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  },

  // Read-only preview of what a range close would hit (client review #5),
  // rendered in the modal above the confirm button. Scoped exactly like
  // closeRange. 404s on an older backend during the deploy window - the
  // caller hides the counts line, never the action.
  getRangeImpact(params: RangeScopeParams): Promise<RangeImpact> {
    return apiFetch<RangeImpact>(
      `/availability/exceptions/range-impact${buildQuery({ ...params })}`
    );
  },

  // Management calendar (operator month grid - one-tap close/reopen layer)
  getManageCalendar(tripId: string, month: string): Promise<ManageCalendarDay[]> {
    return apiFetch<ManageCalendarDay[]>(
      `/availability/manage-calendar${buildQuery({ tourId: tripId, month })}`
    );
  },

  // F13 status line: soonest bookable departure + 30-day open count (the same
  // horizon the §7.2 listing gate counts).
  getAvailabilitySummary(tripId: string): Promise<AvailabilitySummary> {
    return apiFetch<AvailabilitySummary>(
      `/availability/summary${buildQuery({ tourId: tripId })}`
    );
  },
};
