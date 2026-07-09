import type {
  CreateDestinationPayload,
  CreateFaqPayload,
  DestinationDetail,
  DestinationFaq,
  DestinationPageContent,
  DestinationTranslation,
  DestinationsQueryParams,
  DestinationLocalized,
  Locale,
  PaginatedDestinations,
  UpdateDestinationPayload,
  UpdateFaqPayload,
  UpsertPageContentPayload,
  UpsertTranslationPayload,
} from '@/types/destination';

import { apiFetch } from './fetch';

function buildQuery(params: Record<string, string | number | boolean | undefined | null>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      qs.set(key, String(value));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : '';
}

export const destinationsApi = {
  getAll(params: DestinationsQueryParams = {}): Promise<PaginatedDestinations> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
    return apiFetch<PaginatedDestinations>(`/destinations${query}`);
  },

  getActive(locale?: Locale): Promise<DestinationLocalized[]> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<DestinationLocalized[]>(`/destinations/active${query}`);
  },

  getById(id: string, locale?: Locale): Promise<DestinationDetail> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<DestinationDetail>(`/destinations/${id}${query}`);
  },

  getBySlug(slug: string, locale?: Locale): Promise<DestinationDetail> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<DestinationDetail>(`/destinations/slug/${slug}${query}`);
  },

  create(payload: CreateDestinationPayload): Promise<DestinationDetail> {
    return apiFetch<DestinationDetail>('/destinations', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateDestinationPayload): Promise<DestinationDetail> {
    return apiFetch<DestinationDetail>(`/destinations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/destinations/${id}`, {
      method: 'DELETE',
    });
  },

  getTranslations(id: string): Promise<DestinationTranslation[]> {
    return apiFetch<DestinationTranslation[]>(`/destinations/${id}/translations`);
  },

  getTranslationByLocale(id: string, locale: Locale): Promise<DestinationTranslation> {
    return apiFetch<DestinationTranslation>(`/destinations/${id}/translations/${locale}`);
  },

  upsertTranslation(id: string, locale: Locale, payload: UpsertTranslationPayload): Promise<DestinationTranslation> {
    return apiFetch<DestinationTranslation>(`/destinations/${id}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteTranslation(id: string, locale: Locale): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/destinations/${id}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  getPageContent(id: string, locale?: Locale): Promise<DestinationPageContent> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<DestinationPageContent>(`/destinations/${id}/page-content${query}`);
  },

  upsertPageContent(id: string, locale: Locale, payload: UpsertPageContentPayload): Promise<DestinationPageContent> {
    return apiFetch<DestinationPageContent>(`/destinations/${id}/page-content/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getFaqs(id: string, locale?: Locale): Promise<DestinationFaq[]> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<DestinationFaq[]>(`/destinations/${id}/faqs${query}`);
  },

  createFaq(id: string, payload: CreateFaqPayload): Promise<DestinationFaq> {
    return apiFetch<DestinationFaq>(`/destinations/${id}/faqs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateFaq(id: string, faqId: string, payload: UpdateFaqPayload): Promise<DestinationFaq> {
    return apiFetch<DestinationFaq>(`/destinations/${id}/faqs/${faqId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteFaq(id: string, faqId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/destinations/${id}/faqs/${faqId}`, {
      method: 'DELETE',
    });
  },

  forceDelete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/destinations/${id}/force`, {
      method: 'DELETE',
    });
  },
};
