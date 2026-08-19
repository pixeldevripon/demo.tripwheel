import type { Locale } from '@/lib/constants/locales';
import type {
  CreateRecommendationPayload,
  Recommendation,
  RecommendationSettings,
  RecommendationTranslation,
  UpdateRecommendationPayload,
  UpdateRecommendationSettingsPayload,
  UpsertRecommendationTranslationPayload,
} from '@/types/recommendation';
import { apiFetch } from './fetch';

/**
 * Island Tours' post-booking recommendations (thank-you page + confirmation
 * email). All endpoints require MANAGE_EDITORIAL (admin-only) - they advertise
 * OUR picks on surfaces that follow an operator's booking, so operators must
 * never reach them.
 *
 * Every path starts with `recommendations/`, which is what makes `apiFetch`'s
 * path-based public-cache busting map every write here to the `recommendations`
 * tag with no extra wiring - the AI-translation generate route included.
 */
export const recommendationsApi = {
  list(): Promise<Recommendation[]> {
    return apiFetch<Recommendation[]>('/recommendations');
  },

  get(id: string): Promise<Recommendation> {
    return apiFetch<Recommendation>(`/recommendations/${id}`);
  },

  create(payload: CreateRecommendationPayload): Promise<Recommendation> {
    return apiFetch<Recommendation>('/recommendations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(
    id: string,
    payload: UpdateRecommendationPayload,
  ): Promise<Recommendation> {
    return apiFetch<Recommendation>(`/recommendations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  /** 403 on a seeded recommendation - the UI disables the action, this is the backstop. */
  remove(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/recommendations/${id}`, {
      method: 'DELETE',
    });
  },

  getTranslations(id: string): Promise<RecommendationTranslation[]> {
    return apiFetch<RecommendationTranslation[]>(
      `/recommendations/${id}/translations`,
    );
  },

  upsertTranslation(
    id: string,
    locale: Locale,
    payload: UpsertRecommendationTranslationPayload,
  ): Promise<RecommendationTranslation> {
    return apiFetch<RecommendationTranslation>(
      `/recommendations/${id}/translations/${locale}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      },
    );
  },

  /** The per-surface caps on how many cards render. */
  getSettings(): Promise<RecommendationSettings> {
    return apiFetch<RecommendationSettings>('/recommendations/settings');
  },

  updateSettings(
    payload: UpdateRecommendationSettingsPayload,
  ): Promise<RecommendationSettings> {
    return apiFetch<RecommendationSettings>('/recommendations/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
