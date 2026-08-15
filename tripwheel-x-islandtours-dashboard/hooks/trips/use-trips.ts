import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { tripsApi } from '@/lib/api/trips';
import { useTripMutation } from '@/hooks/trips/use-trip-mutation';
import { tripKeys } from '@/lib/trips/query-keys';

export { tripKeys } from '@/lib/trips/query-keys';
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
  AvailabilityOverviewParams,
  DepartureStatus,
  MyTripsQueryParams,
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


// Queries
export function useMyTrips(params: MyTripsQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: tripKeys.myTrips(params),
    queryFn: () => tripsApi.getMyTrips(params),
    enabled,
    // Keep the previous page/search results visible while a new query loads so
    // the toolbar (and the focused search input) never unmounts into a skeleton.
    placeholderData: keepPreviousData,
  });
}

export function useAdminTrips(params: AdminTripsQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: tripKeys.adminTrips(params),
    queryFn: () => tripsApi.getAdminTrips(params),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useTrip(id: string) {
  return useQuery({
    queryKey: tripKeys.detail(id),
    queryFn: () => tripsApi.getById(id),
    enabled: !!id,
  });
}

export function useImages(tripId: string) {
  return useQuery({
    queryKey: tripKeys.images(tripId),
    queryFn: () => tripsApi.getImages(tripId),
    enabled: !!tripId,
  });
}

export function useAddOns(tripId: string) {
  return useQuery({
    queryKey: tripKeys.addOns(tripId),
    queryFn: () => tripsApi.getAddOns(tripId),
    enabled: !!tripId,
  });
}

export function useAgeBands(tripId: string) {
  return useQuery({
    queryKey: tripKeys.ageBands(tripId),
    queryFn: () => tripsApi.getAgeBands(tripId),
    enabled: !!tripId,
  });
}

export function useLanguages(tripId: string) {
  return useQuery({
    queryKey: tripKeys.languages(tripId),
    queryFn: () => tripsApi.getLanguages(tripId),
    enabled: !!tripId,
  });
}

export function useHighlights(tripId: string) {
  return useQuery({
    queryKey: tripKeys.highlights(tripId),
    queryFn: () => tripsApi.getHighlights(tripId),
    enabled: !!tripId,
  });
}

export function useInclusions(tripId: string) {
  return useQuery({
    queryKey: tripKeys.inclusions(tripId),
    queryFn: () => tripsApi.getInclusions(tripId),
    enabled: !!tripId,
  });
}

export function useExclusions(tripId: string) {
  return useQuery({
    queryKey: tripKeys.exclusions(tripId),
    queryFn: () => tripsApi.getExclusions(tripId),
    enabled: !!tripId,
  });
}

export function useFeatures(tripId: string) {
  return useQuery({
    queryKey: tripKeys.features(tripId),
    queryFn: () => tripsApi.getFeatures(tripId),
    enabled: !!tripId,
  });
}

export function useLocations(tripId: string) {
  return useQuery({
    queryKey: tripKeys.locations(tripId),
    queryFn: () => tripsApi.getLocations(tripId),
    enabled: !!tripId,
  });
}

export function usePickupLocations(tripId: string) {
  return useQuery({
    queryKey: tripKeys.pickupLocations(tripId),
    queryFn: () => tripsApi.getPickupLocations(tripId),
    enabled: !!tripId,
  });
}

export function useTripTranslations(tripId: string) {
  return useQuery({
    queryKey: tripKeys.translations(tripId),
    queryFn: () => tripsApi.getTranslations(tripId),
    enabled: !!tripId,
  });
}

export function useTripTranslationByLocale(tripId: string, locale: string) {
  return useQuery({
    queryKey: tripKeys.translationByLocale(tripId, locale),
    queryFn: () => tripsApi.getTranslationByLocale(tripId, locale),
    enabled: !!tripId,
  });
}

export function useSchedules(tripId: string) {
  return useQuery({
    queryKey: tripKeys.schedules(tripId),
    queryFn: () => tripsApi.getSchedules(tripId),
    enabled: !!tripId,
  });
}

export function useExceptions(tripId: string) {
  return useQuery({
    queryKey: tripKeys.exceptions(tripId),
    queryFn: () => tripsApi.getExceptions(tripId),
    enabled: !!tripId,
  });
}

// F13 status line: "is this tour selling?" - next departure + 30-day count.
export function useAvailabilitySummary(tripId: string) {
  return useQuery({
    queryKey: tripKeys.availabilitySummary(tripId),
    queryFn: () => tripsApi.getAvailabilitySummary(tripId),
    enabled: !!tripId,
  });
}

// Operator month grid (one-tap availability calendar). Month = 'YYYY-MM'.
export function useManageCalendar(tripId: string, month: string) {
  return useQuery({
    queryKey: tripKeys.manageCalendar(tripId, month),
    queryFn: () => tripsApi.getManageCalendar(tripId, month),
    enabled: !!tripId && !!month,
    // Keep the previous month's grid on screen while the next streams in, so
    // month navigation never flashes a skeleton.
    placeholderData: (prev) => prev,
  });
}

// Mutations - Core
export const useCreateTrip = () =>
  useTripMutation(
    (payload: CreateTripPayload) => tripsApi.create(payload),
    () => [tripKeys.myTrips({}), tripKeys.adminTrips({})],
  );

export const useUpdateTrip = () =>
  useTripMutation(
    ({ id, payload }: { id: string; payload: UpdateTripPayload }) =>
      tripsApi.update(id, payload),
    ({ id }) => [tripKeys.all, tripKeys.detail(id)],
  );

export const useSubmitTripForReview = () =>
  useTripMutation(
    (id: string) => tripsApi.submitForReview(id),
    (id) => [tripKeys.all, tripKeys.detail(id)],
  );

export const useApproveTrip = () =>
  useTripMutation(
    ({ id, note }: { id: string; note?: string }) => tripsApi.approve(id, note),
    ({ id }) => [tripKeys.all, tripKeys.detail(id)],
  );

export const useRejectTrip = () =>
  useTripMutation(
    ({ id, note }: { id: string; note: string }) => tripsApi.reject(id, note),
    ({ id }) => [tripKeys.all, tripKeys.detail(id)],
  );

export const usePublishTrip = () =>
  useTripMutation(
    (id: string) => tripsApi.publish(id),
    (id) => [tripKeys.all, tripKeys.detail(id)],
  );

export const usePauseTrip = () =>
  useTripMutation(
    (id: string) => tripsApi.pause(id),
    (id) => [tripKeys.all, tripKeys.detail(id)],
  );

export const useUnpauseTrip = () =>
  useTripMutation(
    (id: string) => tripsApi.unpause(id),
    (id) => [tripKeys.all, tripKeys.detail(id)],
  );

// Its own verb, not a key on PATCH /tours/:id - "Likely to sell out" is EARNED,
// so the 2026-08-02 audit took `likelyToSellOutOverride` out of UpdateTourDto to
// stop an operator manufacturing urgency on their own listing.
export const useSetLikelyToSellOut = () =>
  useTripMutation(
    ({ id, value }: { id: string; value: boolean | null }) =>
      tripsApi.setLikelyToSellOut(id, value),
    ({ id }) => [tripKeys.all, tripKeys.detail(id)],
  );

export const useArchiveTrip = () =>
  useTripMutation(
    (id: string) => tripsApi.archive(id),
    (id) => [tripKeys.all, tripKeys.detail(id)],
  );

export const useRestoreTrip = () =>
  useTripMutation(
    (id: string) => tripsApi.restore(id),
    (id) => [tripKeys.all, tripKeys.detail(id)],
  );

export const useRemoveTrip = () =>
  useTripMutation(
    (id: string) => tripsApi.remove(id),
    () => [tripKeys.all],
  );

// Mutations - Images
export const useAddImage = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: AddTourImagePayload }) =>
      tripsApi.addImage(tripId, payload),
    ({ tripId }) => [tripKeys.images(tripId), tripKeys.detail(tripId)],
  );

export const useUpdateImage = () =>
  useTripMutation(
    ({ tripId, imageId, payload }: { tripId: string; imageId: string; payload: UpdateTourImagePayload }) =>
      tripsApi.updateImage(tripId, imageId, payload),
    ({ tripId }) => [tripKeys.images(tripId), tripKeys.detail(tripId)],
  );

export const useRemoveImage = () =>
  useTripMutation(
    ({ tripId, imageId }: { tripId: string; imageId: string }) =>
      tripsApi.removeImage(tripId, imageId),
    ({ tripId }) => [tripKeys.images(tripId), tripKeys.detail(tripId)],
  );

// Mutations - Add-Ons
export const useCreateAddOn = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreateTourAddOnPayload }) =>
      tripsApi.createAddOn(tripId, payload),
    ({ tripId }) => [tripKeys.addOns(tripId)],
  );

export const useUpdateAddOn = () =>
  useTripMutation(
    ({ tripId, addOnId, payload }: { tripId: string; addOnId: string; payload: UpdateTourAddOnPayload }) =>
      tripsApi.updateAddOn(tripId, addOnId, payload),
    ({ tripId }) => [tripKeys.addOns(tripId)],
  );

export const useRemoveAddOn = () =>
  useTripMutation(
    ({ tripId, addOnId }: { tripId: string; addOnId: string }) =>
      tripsApi.removeAddOn(tripId, addOnId),
    ({ tripId }) => [tripKeys.addOns(tripId)],
  );

// Age band mutations also refresh the tour detail because priceFrom recomputes
// from the cheapest band on every change.
export const useCreateAgeBand = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreateTourAgeBandPayload }) =>
      tripsApi.createAgeBand(tripId, payload),
    ({ tripId }) => [tripKeys.ageBands(tripId), tripKeys.detail(tripId)],
  );

export const useUpdateAgeBand = () =>
  useTripMutation(
    ({ tripId, ageBandId, payload }: { tripId: string; ageBandId: string; payload: UpdateTourAgeBandPayload }) =>
      tripsApi.updateAgeBand(tripId, ageBandId, payload),
    ({ tripId }) => [tripKeys.ageBands(tripId), tripKeys.detail(tripId)],
  );

export const useRemoveAgeBand = () =>
  useTripMutation(
    ({ tripId, ageBandId }: { tripId: string; ageBandId: string }) =>
      tripsApi.removeAgeBand(tripId, ageBandId),
    ({ tripId }) => [tripKeys.ageBands(tripId), tripKeys.detail(tripId)],
  );

// Mutations - Languages
export const useAddLanguage = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: AddTourLanguagePayload }) =>
      tripsApi.addLanguage(tripId, payload),
    ({ tripId }) => [tripKeys.languages(tripId)],
  );

export const useRemoveLanguage = () =>
  useTripMutation(
    ({ tripId, languageId }: { tripId: string; languageId: string }) =>
      tripsApi.removeLanguage(tripId, languageId),
    ({ tripId }) => [tripKeys.languages(tripId)],
  );

// Mutations - Highlights
export const useAddHighlight = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreateTourHighlightPayload }) =>
      tripsApi.addHighlight(tripId, payload),
    ({ tripId }) => [tripKeys.highlights(tripId), tripKeys.detail(tripId)],
  );

export const useUpdateHighlight = () =>
  useTripMutation(
    ({ tripId, highlightId, payload }: { tripId: string; highlightId: string; payload: UpdateTourHighlightPayload }) =>
      tripsApi.updateHighlight(tripId, highlightId, payload),
    ({ tripId }) => [tripKeys.highlights(tripId)],
  );

export const useRemoveHighlight = () =>
  useTripMutation(
    ({ tripId, highlightId }: { tripId: string; highlightId: string }) =>
      tripsApi.removeHighlight(tripId, highlightId),
    ({ tripId }) => [tripKeys.highlights(tripId), tripKeys.detail(tripId)],
  );

export const useUpsertHighlightTranslation = () =>
  useTripMutation(
    ({ tripId, highlightId, locale, payload }: { tripId: string; highlightId: string; locale: string; payload: UpsertHighlightTranslationPayload }) =>
      tripsApi.upsertHighlightTranslation(tripId, highlightId, locale, payload),
    ({ tripId }) => [tripKeys.highlights(tripId)],
  );

export const useDeleteHighlightTranslation = () =>
  useTripMutation(
    ({ tripId, highlightId, locale }: { tripId: string; highlightId: string; locale: string }) =>
      tripsApi.deleteHighlightTranslation(tripId, highlightId, locale),
    ({ tripId }) => [tripKeys.highlights(tripId)],
  );

// Mutations - Inclusions
export const useAddInclusion = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreateTourInclusionPayload }) =>
      tripsApi.addInclusion(tripId, payload),
    ({ tripId }) => [tripKeys.inclusions(tripId), tripKeys.detail(tripId)],
  );

export const useUpdateInclusion = () =>
  useTripMutation(
    ({ tripId, inclusionId, payload }: { tripId: string; inclusionId: string; payload: UpdateTourInclusionPayload }) =>
      tripsApi.updateInclusion(tripId, inclusionId, payload),
    ({ tripId }) => [tripKeys.inclusions(tripId)],
  );

export const useRemoveInclusion = () =>
  useTripMutation(
    ({ tripId, inclusionId }: { tripId: string; inclusionId: string }) =>
      tripsApi.removeInclusion(tripId, inclusionId),
    ({ tripId }) => [tripKeys.inclusions(tripId), tripKeys.detail(tripId)],
  );

export const useUpsertInclusionTranslation = () =>
  useTripMutation(
    ({ tripId, inclusionId, locale, payload }: { tripId: string; inclusionId: string; locale: string; payload: UpsertInclusionTranslationPayload }) =>
      tripsApi.upsertInclusionTranslation(tripId, inclusionId, locale, payload),
    ({ tripId }) => [tripKeys.inclusions(tripId)],
  );

export const useDeleteInclusionTranslation = () =>
  useTripMutation(
    ({ tripId, inclusionId, locale }: { tripId: string; inclusionId: string; locale: string }) =>
      tripsApi.deleteInclusionTranslation(tripId, inclusionId, locale),
    ({ tripId }) => [tripKeys.inclusions(tripId)],
  );

// Mutations - Exclusions
export const useAddExclusion = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreateTourExclusionPayload }) =>
      tripsApi.addExclusion(tripId, payload),
    ({ tripId }) => [tripKeys.exclusions(tripId), tripKeys.detail(tripId)],
  );

export const useUpdateExclusion = () =>
  useTripMutation(
    ({ tripId, exclusionId, payload }: { tripId: string; exclusionId: string; payload: UpdateTourExclusionPayload }) =>
      tripsApi.updateExclusion(tripId, exclusionId, payload),
    ({ tripId }) => [tripKeys.exclusions(tripId)],
  );

export const useRemoveExclusion = () =>
  useTripMutation(
    ({ tripId, exclusionId }: { tripId: string; exclusionId: string }) =>
      tripsApi.removeExclusion(tripId, exclusionId),
    ({ tripId }) => [tripKeys.exclusions(tripId), tripKeys.detail(tripId)],
  );

export const useUpsertExclusionTranslation = () =>
  useTripMutation(
    ({ tripId, exclusionId, locale, payload }: { tripId: string; exclusionId: string; locale: string; payload: UpsertExclusionTranslationPayload }) =>
      tripsApi.upsertExclusionTranslation(tripId, exclusionId, locale, payload),
    ({ tripId }) => [tripKeys.exclusions(tripId)],
  );

export const useDeleteExclusionTranslation = () =>
  useTripMutation(
    ({ tripId, exclusionId, locale }: { tripId: string; exclusionId: string; locale: string }) =>
      tripsApi.deleteExclusionTranslation(tripId, exclusionId, locale),
    ({ tripId }) => [tripKeys.exclusions(tripId)],
  );

// Mutations - Features
export const useAddFeature = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreateTourFeaturePayload }) =>
      tripsApi.addFeature(tripId, payload),
    ({ tripId }) => [tripKeys.features(tripId)],
  );

export const useUpdateFeature = () =>
  useTripMutation(
    ({ tripId, featureId, payload }: { tripId: string; featureId: string; payload: UpdateTourFeaturePayload }) =>
      tripsApi.updateFeature(tripId, featureId, payload),
    ({ tripId }) => [tripKeys.features(tripId)],
  );

export const useRemoveFeature = () =>
  useTripMutation(
    ({ tripId, featureId }: { tripId: string; featureId: string }) =>
      tripsApi.removeFeature(tripId, featureId),
    ({ tripId }) => [tripKeys.features(tripId)],
  );

export const useUpsertFeatureTranslation = () =>
  useTripMutation(
    ({ tripId, featureId, locale, payload }: { tripId: string; featureId: string; locale: string; payload: UpsertFeatureTranslationPayload }) =>
      tripsApi.upsertFeatureTranslation(tripId, featureId, locale, payload),
    ({ tripId }) => [tripKeys.features(tripId)],
  );

export const useDeleteFeatureTranslation = () =>
  useTripMutation(
    ({ tripId, featureId, locale }: { tripId: string; featureId: string; locale: string }) =>
      tripsApi.deleteFeatureTranslation(tripId, featureId, locale),
    ({ tripId }) => [tripKeys.features(tripId)],
  );

// Mutations - Locations
export const useAddLocation = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreateTourLocationPayload }) =>
      tripsApi.addLocation(tripId, payload),
    ({ tripId }) => [tripKeys.locations(tripId)],
  );

export const useUpdateLocation = () =>
  useTripMutation(
    ({ tripId, locationId, payload }: { tripId: string; locationId: string; payload: UpdateTourLocationPayload }) =>
      tripsApi.updateLocation(tripId, locationId, payload),
    ({ tripId }) => [tripKeys.locations(tripId)],
  );

export const useRemoveLocation = () =>
  useTripMutation(
    ({ tripId, locationId }: { tripId: string; locationId: string }) =>
      tripsApi.removeLocation(tripId, locationId),
    ({ tripId }) => [tripKeys.locations(tripId)],
  );

export const useUpsertLocationTranslation = () =>
  useTripMutation(
    ({ tripId, locationId, locale, payload }: { tripId: string; locationId: string; locale: string; payload: UpsertLocationTranslationPayload }) =>
      tripsApi.upsertLocationTranslation(tripId, locationId, locale, payload),
    ({ tripId }) => [tripKeys.locations(tripId)],
  );

export const useDeleteLocationTranslation = () =>
  useTripMutation(
    ({ tripId, locationId, locale }: { tripId: string; locationId: string; locale: string }) =>
      tripsApi.deleteLocationTranslation(tripId, locationId, locale),
    ({ tripId }) => [tripKeys.locations(tripId)],
  );

// Mutations - Pickup Locations
export const useAddPickupLocation = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreatePickupLocationPayload }) =>
      tripsApi.addPickupLocation(tripId, payload),
    ({ tripId }) => [tripKeys.pickupLocations(tripId)],
  );

export const useUpdatePickupLocation = () =>
  useTripMutation(
    ({ tripId, pickupLocationId, payload }: { tripId: string; pickupLocationId: string; payload: UpdatePickupLocationPayload }) =>
      tripsApi.updatePickupLocation(tripId, pickupLocationId, payload),
    ({ tripId }) => [tripKeys.pickupLocations(tripId)],
  );

export const useRemovePickupLocation = () =>
  useTripMutation(
    ({ tripId, pickupLocationId }: { tripId: string; pickupLocationId: string }) =>
      tripsApi.removePickupLocation(tripId, pickupLocationId),
    ({ tripId }) => [tripKeys.pickupLocations(tripId)],
  );

export const useUpsertPickupLocationTranslation = () =>
  useTripMutation(
    ({ tripId, pickupLocationId, locale, payload }: { tripId: string; pickupLocationId: string; locale: string; payload: UpsertPickupLocationTranslationPayload }) =>
      tripsApi.upsertPickupLocationTranslation(tripId, pickupLocationId, locale, payload),
    ({ tripId }) => [tripKeys.pickupLocations(tripId)],
  );

export const useDeletePickupLocationTranslation = () =>
  useTripMutation(
    ({ tripId, pickupLocationId, locale }: { tripId: string; pickupLocationId: string; locale: string }) =>
      tripsApi.deletePickupLocationTranslation(tripId, pickupLocationId, locale),
    ({ tripId }) => [tripKeys.pickupLocations(tripId)],
  );

// Mutations - Translations
export const useUpsertTripTranslation = () =>
  useTripMutation(
    ({ tripId, locale, payload }: { tripId: string; locale: string; payload: UpsertTripTranslationPayload }) =>
      tripsApi.upsertTranslation(tripId, locale, payload),
    ({ tripId }) => [tripKeys.translations(tripId), tripKeys.detail(tripId)],
  );

export const useDeleteTripTranslation = () =>
  useTripMutation(
    ({ tripId, locale }: { tripId: string; locale: string }) =>
      tripsApi.deleteTranslation(tripId, locale),
    ({ tripId }) => [tripKeys.translations(tripId), tripKeys.detail(tripId)],
  );

// Mutations - Schedules. Schedule changes re-materialise departures and can flip
// isBookable (the "not yet listed" banner), so they also refresh the trip detail.
const scheduleKeys = (tripId: string) => [
  tripKeys.schedules(tripId),
  tripKeys.manageCalendarAll(tripId),
  tripKeys.availabilitySummary(tripId),
  tripKeys.agendaAll(),
  tripKeys.overviewAll(),
  tripKeys.detail(tripId),
];

export const useCreateSchedule = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreateTourSchedulePayload }) =>
      tripsApi.createSchedule(tripId, payload),
    ({ tripId }) => scheduleKeys(tripId),
  );

export const useUpdateSchedule = () =>
  useTripMutation(
    ({ scheduleId, payload }: { tripId: string; scheduleId: string; payload: UpdateTourSchedulePayload }) =>
      tripsApi.updateSchedule(scheduleId, payload),
    ({ tripId }) => scheduleKeys(tripId),
  );

export const useRemoveSchedule = () =>
  useTripMutation(
    ({ scheduleId }: { tripId: string; scheduleId: string }) =>
      tripsApi.removeSchedule(scheduleId),
    ({ tripId }) => scheduleKeys(tripId),
  );

// Mutations - Exceptions (date-specific overrides). Like schedules, these
// re-materialise departures and can flip isBookable, so refresh the detail too.
const exceptionKeys = (tripId: string) => [
  tripKeys.exceptions(tripId),
  tripKeys.detail(tripId),
  tripKeys.manageCalendarAll(tripId),
  tripKeys.availabilitySummary(tripId),
  tripKeys.agendaAll(),
  tripKeys.overviewAll(),
];

export const useCreateException = () =>
  useTripMutation(
    ({ tripId, payload }: { tripId: string; payload: CreateTourExceptionPayload }) =>
      tripsApi.createException(tripId, payload),
    ({ tripId }) => exceptionKeys(tripId),
  );

// Global calendar overview: one grid across every scoped tour (admin
// platform-wide). Window + filters live in the key; the previous window stays
// on screen while the next loads (same pattern as the agenda).
export function useAvailabilityOverview(params: AvailabilityOverviewParams) {
  return useQuery({
    queryKey: tripKeys.overview(params),
    queryFn: () => tripsApi.getOverview(params),
    placeholderData: (prev) => prev,
    // Paging back to a window inside a minute is instant; mutations still
    // land immediately because every availability write invalidates
    // overviewAll(). Keeps the grid from feeling like a fetch-per-click.
    staleTime: 60_000,
  });
}

// The per-departure capacity/status edit hook was removed with the departure
// card's capacity editor (MCK-16 change 3): capacity is a set-once Details
// property, and no dashboard surface edits departures directly any more. The
// backend PATCH /availability/departures/:id remains for support tooling.

// Surface B: the cross-tour daily agenda.
export function useAgenda(from: string | undefined, days: number) {
  return useQuery({
    queryKey: tripKeys.agenda(from, days),
    queryFn: () => tripsApi.getAgenda({ from, days }),
    // Day paging keeps the previous window on screen while the next loads.
    placeholderData: (prev) => prev,
  });
}

// "Close all of today" (the weather-day action) - the returned tourIds are the
// exact Undo set (reopenRange over the same date, per tour).
export const useCloseAgendaDay = () =>
  useTripMutation(
    (payload: Parameters<typeof tripsApi.closeAgendaDay>[0]) =>
      tripsApi.closeAgendaDay(payload),
    // Cross-tour blast radius: agenda + every per-tour surface.
    () => [tripKeys.all],
  );

// Freshness confirm (F14): stamps availability_confirmed_at. Fire-and-forget
// callers (stamp-on-visit) simply ignore the result. No invalidation, as before.
export const useConfirmAvailability = () =>
  useTripMutation((tripId?: string) => tripsApi.confirmAvailability(tripId));

// Bulk blackout + its one-unit Undo (F8). Same cache blast radius as any
// exception write: register, detail (isBookable), month grid, status line.
// tripId omitted = the all-tours weather-day scope; the cache blast radius is
// then EVERY tour, so invalidation widens to the whole trips domain.
export const useCloseRange = () =>
  useTripMutation(
    ({
      tripId,
      payload,
    }: {
      tripId?: string;
      payload: Omit<Parameters<typeof tripsApi.closeRange>[0], 'tourId'>;
    }) => tripsApi.closeRange({ ...(tripId && { tourId: tripId }), ...payload }),
    ({ tripId }) => (tripId ? exceptionKeys(tripId) : [tripKeys.all]),
  );

export const useReopenRange = () =>
  useTripMutation(
    ({
      tripId,
      payload,
    }: {
      tripId?: string;
      payload: Omit<Parameters<typeof tripsApi.reopenRange>[0], 'tourId'>;
    }) =>
      tripsApi.reopenRange({ ...(tripId && { tourId: tripId }), ...payload }),
    ({ tripId }) => (tripId ? exceptionKeys(tripId) : [tripKeys.all]),
  );

// Live impact preview for the range dialog (client review #5) - what the
// close would hit, updating as the scope and bounds change. keepPrevious so
// the line doesn't blink away between keystrokes - but callers MUST gate on
// isPlaceholderData: a kept number belongs to the PREVIOUS scope, and this
// dialog's whole job is stating the consequence of the current one. No retry
// so an older backend's 404 fails fast and the dialog simply hides the counts.
export function useRangeImpact(
  params: Parameters<typeof tripsApi.getRangeImpact>[0],
  enabled: boolean,
) {
  return useQuery({
    queryKey: tripKeys.rangeImpact(params),
    queryFn: () => tripsApi.getRangeImpact(params),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    retry: false,
  });
}

export const useRemoveException = () =>
  useTripMutation(
    ({ exceptionId }: { tripId: string; exceptionId: string }) =>
      tripsApi.removeException(exceptionId),
    ({ tripId }) => exceptionKeys(tripId),
  );
