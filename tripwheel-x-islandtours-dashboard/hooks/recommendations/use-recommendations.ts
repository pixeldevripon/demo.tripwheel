'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { recommendationsApi } from '@/lib/api/recommendations';
import type { Locale } from '@/lib/constants/locales';
import type {
  CreateRecommendationPayload,
  UpdateRecommendationPayload,
  UpsertRecommendationTranslationPayload,
} from '@/types/recommendation';

export const recommendationKeys = {
  all: () => ['recommendations'] as const,
  list: () => ['recommendations', 'list'] as const,
  detail: (id: string) => ['recommendations', 'detail', id] as const,
  translations: (id: string) =>
    ['recommendations', 'translations', id] as const,
};

export function useRecommendations() {
  return useQuery({
    queryKey: recommendationKeys.list(),
    queryFn: () => recommendationsApi.list(),
  });
}

export function useRecommendation(id: string) {
  return useQuery({
    queryKey: recommendationKeys.detail(id),
    queryFn: () => recommendationsApi.get(id),
    enabled: !!id,
  });
}

/**
 * Every mutation below invalidates the WHOLE `recommendations` key, never just
 * the row it touched. `featuredPlacements` is a fact about the list, not the row:
 * enabling row B or clearing row A's photo can move a card between them, so a
 * targeted invalidation would leave two rows both claiming the same surface.
 */
export function useCreateRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRecommendationPayload) =>
      recommendationsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recommendationKeys.all() });
    },
  });
}

export function useUpdateRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateRecommendationPayload;
    }) => recommendationsApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recommendationKeys.all() });
    },
  });
}

export function useDeleteRecommendation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => recommendationsApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: recommendationKeys.all() });
    },
  });
}

export function useRecommendationTranslations(id: string) {
  return useQuery({
    queryKey: recommendationKeys.translations(id),
    queryFn: () => recommendationsApi.getTranslations(id),
    enabled: !!id,
  });
}

export function useUpsertRecommendationTranslation(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      locale,
      payload,
    }: {
      locale: Locale;
      payload: UpsertRecommendationTranslationPayload;
    }) => recommendationsApi.upsertTranslation(id, locale, payload),
    onSuccess: () => {
      // Not just the translations: the English title is part of the render gate,
      // so saving copy can change which recommendation wins a surface.
      queryClient.invalidateQueries({ queryKey: recommendationKeys.all() });
    },
  });
}
