'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { featuredExperiencesApi, homePageApi } from '@/lib/api/home-page';
import type { Locale } from '@/lib/constants/locales';
import type {
  CreateFeaturedExperiencePayload,
  FeaturedExperience,
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

/**
 * Move a card and renumber the deck in one action.
 *
 * Swapping two neighbours' `displayOrder` is the obvious implementation and it
 * silently does nothing on a deck where several rows share an order (every
 * seeded row is 0, and nothing has ever forced them apart). So this writes
 * POSITIONS instead: the caller passes the list in its intended final order and
 * every row whose index moved is patched to that index. The first move
 * normalises the deck; later ones touch two rows.
 *
 * One invalidation at the end, not one per row - otherwise the grid reshuffles
 * under the cursor mid-reorder.
 */
export function useReorderFeaturedExperiences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ordered: FeaturedExperience[]) => {
      const moved = ordered
        .map((exp, index) => ({ exp, index }))
        .filter(({ exp, index }) => exp.displayOrder !== index);

      await Promise.all(
        moved.map(({ exp, index }) =>
          featuredExperiencesApi.update(exp.id, { displayOrder: index }),
        ),
      );
    },
    onSettled: () => {
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
