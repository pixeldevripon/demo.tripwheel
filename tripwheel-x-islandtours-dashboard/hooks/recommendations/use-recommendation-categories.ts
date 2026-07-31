'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { recommendationCategoriesApi } from '@/lib/api/recommendation-categories';
import type {
  CreateRecommendationCategoryPayload,
  UpdateRecommendationCategoryPayload,
} from '@/types/recommendation';
import { recommendationKeys } from './use-recommendations';

export const recommendationCategoryKeys = {
  all: () => ['recommendation-categories'] as const,
  list: () => ['recommendation-categories', 'list'] as const,
};

export function useRecommendationCategories() {
  return useQuery({
    queryKey: recommendationCategoryKeys.list(),
    queryFn: () => recommendationCategoriesApi.list(),
  });
}

/**
 * Category mutations invalidate BOTH the category list and the recommendations
 * list: a recommendation row embeds its category, so a rename must refresh the
 * rows that show it.
 */
function invalidateBoth(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: recommendationCategoryKeys.all() });
  queryClient.invalidateQueries({ queryKey: recommendationKeys.all() });
}

export function useCreateRecommendationCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateRecommendationCategoryPayload) =>
      recommendationCategoriesApi.create(payload),
    onSuccess: () => invalidateBoth(queryClient),
  });
}

export function useUpdateRecommendationCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      categoryId,
      payload,
    }: {
      categoryId: string;
      payload: UpdateRecommendationCategoryPayload;
    }) => recommendationCategoriesApi.update(categoryId, payload),
    onSuccess: () => invalidateBoth(queryClient),
  });
}

export function useDeleteRecommendationCategory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categoryId: string) =>
      recommendationCategoriesApi.remove(categoryId),
    onSuccess: () => invalidateBoth(queryClient),
  });
}
