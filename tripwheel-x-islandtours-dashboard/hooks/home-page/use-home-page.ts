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

/**
 * Save one editor tab in a single action.
 *
 * A homepage section mixes locale-agnostic fields (images, the CTA target) with
 * English copy, which live behind two different endpoints. An admin filling in
 * a Hero tab should press Save once, so this composes both and only reports
 * success when both land. Either half may be omitted.
 */
export function useSaveHomepageSection() {
  const updateContent = useUpdateHomePage();
  const upsertCopy = useUpsertHomePageTranslation();

  async function save({
    base,
    fields,
  }: {
    base?: UpdateHomePagePayload;
    fields?: UpsertHomePageTranslationPayload['fields'];
  }) {
    // Sequential, not parallel: both write the same singleton, and a failed
    // copy write after a successful image write is far easier to reason about
    // than two half-applied writes racing.
    if (base && Object.keys(base).length) {
      await updateContent.mutateAsync(base);
    }
    if (fields && Object.keys(fields).length) {
      await upsertCopy.mutateAsync({ locale: 'en', payload: { fields } });
    }
  }

  return { save, isPending: updateContent.isPending || upsertCopy.isPending };
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
