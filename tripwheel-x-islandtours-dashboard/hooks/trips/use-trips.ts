import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripsApi } from '@/lib/api/trips';
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
export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTripPayload) => tripsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.myTrips({}) });
      queryClient.invalidateQueries({ queryKey: tripKeys.adminTrips({}) });
    },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: UpdateTripPayload }) =>
      tripsApi.update(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.id) });
    },
  });
}

export function useSubmitTripForReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tripsApi.submitForReview(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
    },
  });
}

export function useApproveTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note?: string }) =>
      tripsApi.approve(id, note),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
    },
  });
}

export function useRejectTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) =>
      tripsApi.reject(id, note),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
    },
  });
}

export function usePublishTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tripsApi.publish(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
    },
  });
}

export function usePauseTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tripsApi.pause(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
    },
  });
}

export function useUnpauseTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tripsApi.unpause(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
    },
  });
}

export function useArchiveTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tripsApi.archive(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
    },
  });
}

export function useRestoreTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tripsApi.restore(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(id) });
    },
  });
}

export function useRemoveTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tripsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
    },
  });
}

// Mutations - Images
export function useAddImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: AddTourImagePayload }) =>
      tripsApi.addImage(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.images(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useUpdateImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, imageId, payload }: { tripId: string; imageId: string; payload: UpdateTourImagePayload }) =>
      tripsApi.updateImage(tripId, imageId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.images(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useRemoveImage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, imageId }: { tripId: string; imageId: string }) =>
      tripsApi.removeImage(tripId, imageId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.images(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

// Mutations - Add-Ons
export function useCreateAddOn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourAddOnPayload }) =>
      tripsApi.createAddOn(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.addOns(variables.tripId) });
    },
  });
}

export function useUpdateAddOn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, addOnId, payload }: { tripId: string; addOnId: string; payload: UpdateTourAddOnPayload }) =>
      tripsApi.updateAddOn(tripId, addOnId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.addOns(variables.tripId) });
    },
  });
}

export function useRemoveAddOn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, addOnId }: { tripId: string; addOnId: string }) =>
      tripsApi.removeAddOn(tripId, addOnId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.addOns(variables.tripId) });
    },
  });
}

// Age band mutations also refresh the tour detail because priceFrom recomputes
// from the cheapest band on every change.
export function useCreateAgeBand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourAgeBandPayload }) =>
      tripsApi.createAgeBand(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.ageBands(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useUpdateAgeBand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, ageBandId, payload }: { tripId: string; ageBandId: string; payload: UpdateTourAgeBandPayload }) =>
      tripsApi.updateAgeBand(tripId, ageBandId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.ageBands(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useRemoveAgeBand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, ageBandId }: { tripId: string; ageBandId: string }) =>
      tripsApi.removeAgeBand(tripId, ageBandId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.ageBands(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

// Mutations - Languages
export function useAddLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: AddTourLanguagePayload }) =>
      tripsApi.addLanguage(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.languages(variables.tripId) });
    },
  });
}

export function useRemoveLanguage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, languageId }: { tripId: string; languageId: string }) =>
      tripsApi.removeLanguage(tripId, languageId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.languages(variables.tripId) });
    },
  });
}

// Mutations - Highlights
export function useAddHighlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourHighlightPayload }) =>
      tripsApi.addHighlight(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.highlights(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useUpdateHighlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, highlightId, payload }: { tripId: string; highlightId: string; payload: UpdateTourHighlightPayload }) =>
      tripsApi.updateHighlight(tripId, highlightId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.highlights(variables.tripId) });
    },
  });
}

export function useRemoveHighlight() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, highlightId }: { tripId: string; highlightId: string }) =>
      tripsApi.removeHighlight(tripId, highlightId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.highlights(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useUpsertHighlightTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      highlightId,
      locale,
      payload,
    }: {
      tripId: string;
      highlightId: string;
      locale: string;
      payload: UpsertHighlightTranslationPayload;
    }) => tripsApi.upsertHighlightTranslation(tripId, highlightId, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.highlights(variables.tripId) });
    },
  });
}

export function useDeleteHighlightTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, highlightId, locale }: { tripId: string; highlightId: string; locale: string }) =>
      tripsApi.deleteHighlightTranslation(tripId, highlightId, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.highlights(variables.tripId) });
    },
  });
}

// Mutations - Inclusions
export function useAddInclusion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourInclusionPayload }) =>
      tripsApi.addInclusion(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.inclusions(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useUpdateInclusion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, inclusionId, payload }: { tripId: string; inclusionId: string; payload: UpdateTourInclusionPayload }) =>
      tripsApi.updateInclusion(tripId, inclusionId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.inclusions(variables.tripId) });
    },
  });
}

export function useRemoveInclusion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, inclusionId }: { tripId: string; inclusionId: string }) =>
      tripsApi.removeInclusion(tripId, inclusionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.inclusions(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useUpsertInclusionTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      inclusionId,
      locale,
      payload,
    }: {
      tripId: string;
      inclusionId: string;
      locale: string;
      payload: UpsertInclusionTranslationPayload;
    }) => tripsApi.upsertInclusionTranslation(tripId, inclusionId, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.inclusions(variables.tripId) });
    },
  });
}

export function useDeleteInclusionTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, inclusionId, locale }: { tripId: string; inclusionId: string; locale: string }) =>
      tripsApi.deleteInclusionTranslation(tripId, inclusionId, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.inclusions(variables.tripId) });
    },
  });
}

// Mutations - Exclusions
export function useAddExclusion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourExclusionPayload }) =>
      tripsApi.addExclusion(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.exclusions(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useUpdateExclusion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, exclusionId, payload }: { tripId: string; exclusionId: string; payload: UpdateTourExclusionPayload }) =>
      tripsApi.updateExclusion(tripId, exclusionId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.exclusions(variables.tripId) });
    },
  });
}

export function useRemoveExclusion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, exclusionId }: { tripId: string; exclusionId: string }) =>
      tripsApi.removeExclusion(tripId, exclusionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.exclusions(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useUpsertExclusionTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      exclusionId,
      locale,
      payload,
    }: {
      tripId: string;
      exclusionId: string;
      locale: string;
      payload: UpsertExclusionTranslationPayload;
    }) => tripsApi.upsertExclusionTranslation(tripId, exclusionId, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.exclusions(variables.tripId) });
    },
  });
}

export function useDeleteExclusionTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, exclusionId, locale }: { tripId: string; exclusionId: string; locale: string }) =>
      tripsApi.deleteExclusionTranslation(tripId, exclusionId, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.exclusions(variables.tripId) });
    },
  });
}

// Mutations - Features
export function useAddFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourFeaturePayload }) =>
      tripsApi.addFeature(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.features(variables.tripId) });
    },
  });
}

export function useUpdateFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, featureId, payload }: { tripId: string; featureId: string; payload: UpdateTourFeaturePayload }) =>
      tripsApi.updateFeature(tripId, featureId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.features(variables.tripId) });
    },
  });
}

export function useRemoveFeature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, featureId }: { tripId: string; featureId: string }) =>
      tripsApi.removeFeature(tripId, featureId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.features(variables.tripId) });
    },
  });
}

export function useUpsertFeatureTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      featureId,
      locale,
      payload,
    }: {
      tripId: string;
      featureId: string;
      locale: string;
      payload: UpsertFeatureTranslationPayload;
    }) => tripsApi.upsertFeatureTranslation(tripId, featureId, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.features(variables.tripId) });
    },
  });
}

export function useDeleteFeatureTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, featureId, locale }: { tripId: string; featureId: string; locale: string }) =>
      tripsApi.deleteFeatureTranslation(tripId, featureId, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.features(variables.tripId) });
    },
  });
}

// Mutations - Locations
export function useAddLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourLocationPayload }) =>
      tripsApi.addLocation(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.locations(variables.tripId) });
    },
  });
}

export function useUpdateLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, locationId, payload }: { tripId: string; locationId: string; payload: UpdateTourLocationPayload }) =>
      tripsApi.updateLocation(tripId, locationId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.locations(variables.tripId) });
    },
  });
}

export function useRemoveLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, locationId }: { tripId: string; locationId: string }) =>
      tripsApi.removeLocation(tripId, locationId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.locations(variables.tripId) });
    },
  });
}

export function useUpsertLocationTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      locationId,
      locale,
      payload,
    }: {
      tripId: string;
      locationId: string;
      locale: string;
      payload: UpsertLocationTranslationPayload;
    }) => tripsApi.upsertLocationTranslation(tripId, locationId, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.locations(variables.tripId) });
    },
  });
}

export function useDeleteLocationTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, locationId, locale }: { tripId: string; locationId: string; locale: string }) =>
      tripsApi.deleteLocationTranslation(tripId, locationId, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.locations(variables.tripId) });
    },
  });
}

// Mutations - Pickup Locations
export function useAddPickupLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreatePickupLocationPayload }) =>
      tripsApi.addPickupLocation(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.pickupLocations(variables.tripId) });
    },
  });
}

export function useUpdatePickupLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, pickupLocationId, payload }: { tripId: string; pickupLocationId: string; payload: UpdatePickupLocationPayload }) =>
      tripsApi.updatePickupLocation(tripId, pickupLocationId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.pickupLocations(variables.tripId) });
    },
  });
}

export function useRemovePickupLocation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, pickupLocationId }: { tripId: string; pickupLocationId: string }) =>
      tripsApi.removePickupLocation(tripId, pickupLocationId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.pickupLocations(variables.tripId) });
    },
  });
}

export function useUpsertPickupLocationTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      pickupLocationId,
      locale,
      payload,
    }: {
      tripId: string;
      pickupLocationId: string;
      locale: string;
      payload: UpsertPickupLocationTranslationPayload;
    }) => tripsApi.upsertPickupLocationTranslation(tripId, pickupLocationId, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.pickupLocations(variables.tripId) });
    },
  });
}

export function useDeletePickupLocationTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, pickupLocationId, locale }: { tripId: string; pickupLocationId: string; locale: string }) =>
      tripsApi.deletePickupLocationTranslation(tripId, pickupLocationId, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.pickupLocations(variables.tripId) });
    },
  });
}

// Mutations - Translations
export function useUpsertTripTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      locale,
      payload,
    }: {
      tripId: string;
      locale: string;
      payload: UpsertTripTranslationPayload;
    }) => tripsApi.upsertTranslation(tripId, locale, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.translations(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useDeleteTripTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, locale }: { tripId: string; locale: string }) =>
      tripsApi.deleteTranslation(tripId, locale),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.translations(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

// Mutations - Schedules
export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourSchedulePayload }) =>
      tripsApi.createSchedule(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.schedules(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.manageCalendarAll(variables.tripId) });
      // Schedule changes re-materialise departures and can flip isBookable, which
      // drives the "not yet listed" banner - refresh the trip detail too.
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scheduleId,
      payload,
    }: {
      tripId: string;
      scheduleId: string;
      payload: UpdateTourSchedulePayload;
    }) => tripsApi.updateSchedule(scheduleId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.schedules(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.manageCalendarAll(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

export function useRemoveSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scheduleId }: { tripId: string; scheduleId: string }) =>
      tripsApi.removeSchedule(scheduleId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.schedules(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.manageCalendarAll(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
    },
  });
}

// Mutations - Exceptions (date-specific overrides). Like schedules, these
// re-materialise departures and can flip isBookable, so refresh the detail too.
export function useCreateException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourExceptionPayload }) =>
      tripsApi.createException(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.exceptions(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.manageCalendarAll(variables.tripId) });
    },
  });
}

export function useRemoveException() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ exceptionId }: { tripId: string; exceptionId: string }) =>
      tripsApi.removeException(exceptionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.exceptions(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.detail(variables.tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.manageCalendarAll(variables.tripId) });
    },
  });
}
