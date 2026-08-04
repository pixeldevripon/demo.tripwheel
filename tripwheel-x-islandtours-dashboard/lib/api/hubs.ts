import type {
  CreateHubPayload,
  CreateHubFaqPayload,
  HubDetail,
  HubFaq,
  HubPageContent,
  HubTranslation,
  HubsQueryParams,
  HubLocalized,
  HubAllowedCategory,
  PaginatedHubs,
  UpdateHubPayload,
  UpdateHubFaqPayload,
  UpsertHubPageContentPayload,
  UpsertHubTranslationPayload,
  HubContentSection,
  ReplaceContentSectionsPayload,
  ReplaceContentSectionsResponse,
  HubOurPick,
  HubOurPickForEdit,
  SetOurPicksPayload,
  SetOurPicksResponse,
  ComparisonGroupItem,
  ComparisonGroupForEdit,
  SetComparisonPayload,
  SetComparisonResponse,
  UpsertOurPickTranslationPayload,
  UpsertComparisonGroupTranslationPayload,
  UpsertComparisonTourTranslationPayload,
  UpsertHubSectionTranslationPayload,
  Locale,
} from '@/types/hub';
import type { HubSectionType } from '@/types/enums';

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

export const hubsApi = {
  getAll(params: HubsQueryParams = {}): Promise<PaginatedHubs> {
    const query = buildQuery(params as Record<string, string | number | boolean | undefined | null>);
    return apiFetch<PaginatedHubs>(`/hubs${query}`);
  },

  getActive(destinationId?: string): Promise<HubLocalized[]> {
    const query = buildQuery({ destinationId: destinationId ?? undefined });
    return apiFetch<HubLocalized[]>(`/hubs/active${query}`);
  },

  getById(id: string, locale?: Locale): Promise<HubDetail> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<HubDetail>(`/hubs/${id}${query}`);
  },

  getBySlug(slug: string, destinationSlug: string, locale?: Locale): Promise<HubDetail> {
    const query = buildQuery({ destinationSlug, locale: locale ?? undefined });
    return apiFetch<HubDetail>(`/hubs/slug/${slug}${query}`);
  },

  create(payload: CreateHubPayload): Promise<HubDetail> {
    return apiFetch<HubDetail>('/hubs', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdateHubPayload): Promise<HubDetail> {
    return apiFetch<HubDetail>(`/hubs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  forceDelete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hubs/${id}/force`, {
      method: 'DELETE',
    });
  },

  delete(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hubs/${id}`, {
      method: 'DELETE',
    });
  },

  getTranslations(id: string): Promise<HubTranslation[]> {
    return apiFetch<HubTranslation[]>(`/hubs/${id}/translations`);
  },

  getTranslationByLocale(id: string, locale: Locale): Promise<HubTranslation> {
    return apiFetch<HubTranslation>(`/hubs/${id}/translations/${locale}`);
  },

  upsertTranslation(id: string, locale: Locale, payload: UpsertHubTranslationPayload): Promise<HubTranslation> {
    return apiFetch<HubTranslation>(`/hubs/${id}/translations/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteTranslation(id: string, locale: Locale): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hubs/${id}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  getPageContent(id: string, locale?: Locale): Promise<HubPageContent> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<HubPageContent>(`/hubs/${id}/page-content${query}`);
  },

  upsertPageContent(id: string, locale: Locale, payload: UpsertHubPageContentPayload): Promise<HubPageContent> {
    return apiFetch<HubPageContent>(`/hubs/${id}/page-content/${locale}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  getFaqs(id: string, locale?: Locale): Promise<HubFaq[]> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<HubFaq[]>(`/hubs/${id}/faqs${query}`);
  },

  createFaq(id: string, payload: CreateHubFaqPayload): Promise<HubFaq> {
    return apiFetch<HubFaq>(`/hubs/${id}/faqs`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  updateFaq(id: string, faqId: string, payload: UpdateHubFaqPayload): Promise<HubFaq> {
    return apiFetch<HubFaq>(`/hubs/${id}/faqs/${faqId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  deleteFaq(id: string, faqId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hubs/${id}/faqs/${faqId}`, {
      method: 'DELETE',
    });
  },

  getAllowedCategories(id: string): Promise<HubAllowedCategory[]> {
    return apiFetch<HubAllowedCategory[]>(`/hubs/${id}/allowed-categories`);
  },

  addAllowedCategory(id: string, categoryId: string): Promise<HubAllowedCategory> {
    return apiFetch<HubAllowedCategory>(`/hubs/${id}/allowed-categories`, {
      method: 'POST',
      body: JSON.stringify({ categoryId }),
    });
  },

  removeAllowedCategory(id: string, categoryId: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/hubs/${id}/allowed-categories/${categoryId}`, {
      method: 'DELETE',
    });
  },

  // ── Content sections ────────────────────────────────────────────────────────
  getContentSections(id: string, locale?: Locale): Promise<HubContentSection[]> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<HubContentSection[]>(`/hubs/${id}/content-sections${query}`);
  },

  /**
   * EVERY stored locale, for the Translation Console. Do NOT use
   * `getContentSections` for that: its `locale` query param defaults to `en`
   * on the backend, so omitting it returns English only and every translated
   * field reads back blank.
   */
  getContentSectionsForEdit(id: string): Promise<HubContentSection[]> {
    return apiFetch<HubContentSection[]>(`/hubs/${id}/content-sections/edit`);
  },

  replaceContentSections(
    id: string,
    payload: ReplaceContentSectionsPayload
  ): Promise<ReplaceContentSectionsResponse> {
    return apiFetch<ReplaceContentSectionsResponse>(`/hubs/${id}/content-sections`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // ── Our Picks ─────────────────────────────────────────────────────────────────
  getOurPicks(id: string, locale?: Locale): Promise<SetOurPicksResponse> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<SetOurPicksResponse>(`/hubs/${id}/our-picks${query}`);
  },

  /** Admin read-back with every locale's blurb (for the Our Picks editor tabs). */
  getOurPicksForEdit(id: string): Promise<HubOurPickForEdit[]> {
    return apiFetch<HubOurPickForEdit[]>(`/hubs/${id}/our-picks/edit`);
  },

  setOurPicks(id: string, payload: SetOurPicksPayload): Promise<SetOurPicksResponse> {
    return apiFetch<SetOurPicksResponse>(`/hubs/${id}/our-picks`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // ── Comparison ──────────────────────────────────────────────────────────────
  getComparison(id: string, locale?: Locale): Promise<SetComparisonResponse> {
    const query = buildQuery({ locale: locale ?? undefined });
    return apiFetch<SetComparisonResponse>(`/hubs/${id}/comparison${query}`);
  },

  /** Admin read-back with every locale's standout note (for the comparison editor tabs). */
  getComparisonForEdit(id: string): Promise<ComparisonGroupForEdit[]> {
    return apiFetch<ComparisonGroupForEdit[]>(`/hubs/${id}/comparison/edit`);
  },

  setComparison(id: string, payload: SetComparisonPayload): Promise<SetComparisonResponse> {
    return apiFetch<SetComparisonResponse>(`/hubs/${id}/comparison`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // ── Curation translation upserts (Translation Console per-item saves) ────────

  upsertOurPickTranslation(
    id: string,
    pickId: string,
    locale: Locale,
    payload: UpsertOurPickTranslationPayload
  ): Promise<{ locale: Locale; description: string }> {
    return apiFetch(`/hubs/${id}/our-picks/${pickId}/translations/${locale}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  upsertComparisonGroupTranslation(
    id: string,
    groupId: string,
    locale: Locale,
    payload: UpsertComparisonGroupTranslationPayload
  ): Promise<{ locale: Locale; groupName: string }> {
    return apiFetch(`/hubs/${id}/comparison/groups/${groupId}/translations/${locale}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  upsertComparisonTourTranslation(
    id: string,
    comparisonTourId: string,
    locale: Locale,
    payload: UpsertComparisonTourTranslationPayload
  ): Promise<{ locale: Locale; standoutNote: string }> {
    return apiFetch(`/hubs/${id}/comparison/tours/${comparisonTourId}/translations/${locale}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  upsertContentSectionTranslation(
    id: string,
    sectionType: HubSectionType,
    displayOrder: number,
    locale: Locale,
    payload: UpsertHubSectionTranslationPayload
  ): Promise<HubContentSection> {
    return apiFetch(
      `/hubs/${id}/content-sections/${sectionType}/${displayOrder}/translations/${locale}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  // ── Curation translation clears ─────────────────────────────────────────────
  // Every one of these columns is NOT NULL, so "cleared" means the row is
  // gone and the public page falls back to the English base value.

  deleteOurPickTranslation(
    id: string,
    pickId: string,
    locale: Locale
  ): Promise<{ message: string }> {
    return apiFetch(`/hubs/${id}/our-picks/${pickId}/translations/${locale}`, {
      method: 'DELETE',
    });
  },

  deleteComparisonGroupTranslation(
    id: string,
    groupId: string,
    locale: Locale
  ): Promise<{ message: string }> {
    return apiFetch(
      `/hubs/${id}/comparison/groups/${groupId}/translations/${locale}`,
      { method: 'DELETE' }
    );
  },

  deleteComparisonTourTranslation(
    id: string,
    comparisonTourId: string,
    locale: Locale
  ): Promise<{ message: string }> {
    return apiFetch(
      `/hubs/${id}/comparison/tours/${comparisonTourId}/translations/${locale}`,
      { method: 'DELETE' }
    );
  },

  deleteContentSectionTranslation(
    id: string,
    sectionType: HubSectionType,
    displayOrder: number,
    locale: Locale
  ): Promise<{ message: string }> {
    return apiFetch(
      `/hubs/${id}/content-sections/${sectionType}/${displayOrder}/translations/${locale}`,
      { method: 'DELETE' }
    );
  },
};
