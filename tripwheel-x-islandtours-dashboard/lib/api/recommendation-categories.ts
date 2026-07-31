import type {
  CreateRecommendationCategoryPayload,
  RecommendationCategory,
  UpdateRecommendationCategoryPayload,
} from '@/types/recommendation';
import { apiFetch } from './fetch';

/**
 * Recommendation categories - the buckets the thank-you page and confirmation
 * email group their picks by (Hotels, Restaurants, Shops, ...).
 *
 * Every path starts with `recommendations/`, so `apiFetch`'s path-based
 * public-cache busting maps each write here to the `recommendations` tag with no
 * extra wiring.
 */
export const recommendationCategoriesApi = {
  list(): Promise<RecommendationCategory[]> {
    return apiFetch<RecommendationCategory[]>('/recommendations/categories');
  },

  create(
    payload: CreateRecommendationCategoryPayload,
  ): Promise<RecommendationCategory> {
    return apiFetch<RecommendationCategory>('/recommendations/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(
    categoryId: string,
    payload: UpdateRecommendationCategoryPayload,
  ): Promise<RecommendationCategory> {
    return apiFetch<RecommendationCategory>(
      `/recommendations/categories/${categoryId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  },

  /** 403 on a seeded category - the UI disables the action, this is the backstop. */
  remove(categoryId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(
      `/recommendations/categories/${categoryId}`,
      { method: 'DELETE' },
    );
  },
};
