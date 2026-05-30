import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tripsApi } from '@/lib/api/trips';
import type {
  AddTourImagePayload,
  AddTourLanguagePayload,
  AdminTripsQueryParams,
  CreateTourAddOnPayload,
  CreateTourAgeBandPayload,
  CreateTourHighlightPayload,
  CreateTourInclusionPayload,
  CreateTourSchedulePayload,
  CreateTripPayload,
  MyTripsQueryParams,
  UpdateTourAddOnPayload,
  UpdateTourAgeBandPayload,
  UpdateTourHighlightPayload,
  UpdateTourImagePayload,
  UpdateTourInclusionPayload,
  UpdateTourSchedulePayload,
  UpdateTripPayload,
  UpsertHighlightTranslationPayload,
  UpsertInclusionTranslationPayload,
  UpsertTripTranslationPayload,
} from '@/types/trip';

export const tripKeys = {
  all: ['trips'] as const,
  myTrips: (params: MyTripsQueryParams) => [...tripKeys.all, 'my-trips', params] as const,
  adminTrips: (params: AdminTripsQueryParams) => [...tripKeys.all, 'admin-all', params] as const,
  details: () => [...tripKeys.all, 'detail'] as const,
  detail: (id: string) => [...tripKeys.details(), id] as const,
  images: (tripId: string) => [...tripKeys.all, 'images', tripId] as const,
  ageBands: (tripId: string) => [...tripKeys.all, 'age-bands', tripId] as const,
  addOns: (tripId: string) => [...tripKeys.all, 'addons', tripId] as const,
  languages: (tripId: string) => [...tripKeys.all, 'languages', tripId] as const,
  highlights: (tripId: string) => [...tripKeys.all, 'highlights', tripId] as const,
  inclusions: (tripId: string) => [...tripKeys.all, 'inclusions', tripId] as const,
  translations: (tripId: string) => [...tripKeys.all, 'translations', tripId] as const,
  translationByLocale: (tripId: string, locale: string) => [...tripKeys.translations(tripId), locale] as const,
  schedules: (tripId: string) => [...tripKeys.all, 'schedules', tripId] as const,
};

// Queries
export function useMyTrips(params: MyTripsQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: tripKeys.myTrips(params),
    queryFn: () => tripsApi.getMyTrips(params),
    enabled,
  });
}

export function useAdminTrips(params: AdminTripsQueryParams = {}, enabled = true) {
  return useQuery({
    queryKey: tripKeys.adminTrips(params),
    queryFn: () => tripsApi.getAdminTrips(params),
    enabled,
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

export function useAgeBands(tripId: string) {
  return useQuery({
    queryKey: tripKeys.ageBands(tripId),
    queryFn: () => tripsApi.getAgeBands(tripId),
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

// Mutations — Core
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

// Mutations — Images
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

// Mutations — Age Bands
export function useCreateAgeBand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourAgeBandPayload }) =>
      tripsApi.createAgeBand(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.ageBands(variables.tripId) });
    },
  });
}

export function useUpdateAgeBand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, bandId, payload }: { tripId: string; bandId: string; payload: UpdateTourAgeBandPayload }) =>
      tripsApi.updateAgeBand(tripId, bandId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.ageBands(variables.tripId) });
    },
  });
}

export function useRemoveAgeBand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, bandId }: { tripId: string; bandId: string }) =>
      tripsApi.removeAgeBand(tripId, bandId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.ageBands(variables.tripId) });
    },
  });
}

// Mutations — Add-Ons
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

// Mutations — Languages
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

// Mutations — Highlights
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

// Mutations — Inclusions
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

// Mutations — Translations
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

// Mutations — Schedules
export function useCreateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, payload }: { tripId: string; payload: CreateTourSchedulePayload }) =>
      tripsApi.createSchedule(tripId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.schedules(variables.tripId) });
    },
  });
}

export function useUpdateSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      scheduleId,
      payload,
    }: {
      tripId: string;
      scheduleId: string;
      payload: UpdateTourSchedulePayload;
    }) => tripsApi.updateSchedule(tripId, scheduleId, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.schedules(variables.tripId) });
    },
  });
}

export function useRemoveSchedule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, scheduleId }: { tripId: string; scheduleId: string }) =>
      tripsApi.removeSchedule(tripId, scheduleId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.schedules(variables.tripId) });
    },
  });
}
