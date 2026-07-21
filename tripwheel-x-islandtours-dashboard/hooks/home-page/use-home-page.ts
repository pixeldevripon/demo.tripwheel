'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { featuredExperiencesApi, homePageApi } from '@/lib/api/home-page';
import type { Locale } from '@/lib/constants/locales';
import type {
  CreateFeaturedExperiencePayload,
  UpdateFeaturedExperiencePayload,
  UpdateHomePagePayload,
  UpsertHomePageTranslationPayload,
} from '@/types/home-page';

export const homePageKeys = {
  all: () => ['home-page'] as const,
  content: () => ['home-page', 'content'] as const,
  translations: () => ['home-page', 'translations'] as const,
  featured: () => ['home-page', 'featured-experiences'] as const,
};

export function useHomePage() {
  return useQuery({
    queryKey: homePageKeys.content(),
    queryFn: () => homePageApi.get(),
  });
}

export function useUpdateHomePage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateHomePagePayload) => homePageApi.update(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homePageKeys.all() });
    },
  });
}

export function useHomePageTranslations() {
  return useQuery({
    queryKey: homePageKeys.translations(),
    queryFn: () => homePageApi.getTranslations(),
  });
}

export function useUpsertHomePageTranslation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      locale,
      payload,
    }: {
      locale: Locale;
      payload: UpsertHomePageTranslationPayload;
    }) => homePageApi.upsertTranslation(locale, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homePageKeys.all() });
    },
  });
}

// ── Top Island Experiences ───────────────────────────────────────────────────

export function useFeaturedExperiences() {
  return useQuery({
    queryKey: homePageKeys.featured(),
    queryFn: () => featuredExperiencesApi.list(),
  });
}

export function useCreateFeaturedExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateFeaturedExperiencePayload) =>
      featuredExperiencesApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homePageKeys.featured() });
    },
  });
}

export function useUpdateFeaturedExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: UpdateFeaturedExperiencePayload;
    }) => featuredExperiencesApi.update(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homePageKeys.featured() });
    },
  });
}

export function useDeleteFeaturedExperience() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => featuredExperiencesApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: homePageKeys.featured() });
    },
  });
}
