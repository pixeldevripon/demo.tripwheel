import type { Locale } from '@/lib/constants/locales';
import type {
  CreateFeaturedExperiencePayload,
  FeaturedExperience,
  HomePageContent,
  HomePageTranslation,
  UpdateFeaturedExperiencePayload,
  UpdateHomePagePayload,
  UpsertHomePageTranslationPayload,
} from '@/types/home-page';
import { apiFetch } from './fetch';

/**
 * Homepage content + Top Island Experiences. All endpoints require
 * MANAGE_EDITORIAL (admin-only).
 *
 * `HOME_ID` is the singleton key. It appears in the FAQ paths because the shared
 * FaqManager/faqGroupsApi build `{basePath}/{id}/faqs/groups` for every entity -
 * the homepage satisfies that shape rather than getting a special case.
 */
export const HOME_ID = 'default';

export const homePageApi = {
  get(): Promise<HomePageContent> {
    return apiFetch<HomePageContent>('/home-page');
  },

  update(payload: UpdateHomePagePayload): Promise<HomePageContent> {
    return apiFetch<HomePageContent>('/home-page', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getTranslations(): Promise<HomePageTranslation[]> {
    return apiFetch<HomePageTranslation[]>('/home-page/translations');
  },

  upsertTranslation(
    locale: Locale,
    payload: UpsertHomePageTranslationPayload,
  ): Promise<HomePageTranslation> {
    return apiFetch<HomePageTranslation>(`/home-page/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};

export const featuredExperiencesApi = {
  list(): Promise<FeaturedExperience[]> {
    return apiFetch<FeaturedExperience[]>('/featured-experiences');
  },

  create(
    payload: CreateFeaturedExperiencePayload,
  ): Promise<FeaturedExperience> {
    return apiFetch<FeaturedExperience>('/featured-experiences', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(
    id: string,
    payload: UpdateFeaturedExperiencePayload,
  ): Promise<FeaturedExperience> {
    return apiFetch<FeaturedExperience>(`/featured-experiences/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(id: string): Promise<void> {
    return apiFetch<void>(`/featured-experiences/${id}`, { method: 'DELETE' });
  },
};
