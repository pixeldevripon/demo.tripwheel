import type { Locale } from '@/lib/constants/locales';
import type {
  CreateFaqGroupPayload,
  FaqGroup,
  FaqTranslation,
  UpdateFaqGroupPayload,
  UpsertFaqTranslationPayload,
} from '@/types/faq';

import { apiFetch } from './fetch';

/**
 * Grouped-FAQ client, shared across every entity that owns FAQs. `basePath` is the
 * module segment (e.g. `/destinations`, `/categories`, `/hubs`, `/collections`);
 * `id` is the owning entity's id. Endpoint shape is identical across modules.
 */
export const faqGroupsApi = {
  list(basePath: string, id: string): Promise<FaqGroup[]> {
    return apiFetch<FaqGroup[]>(`${basePath}/${id}/faqs/groups`);
  },

  create(basePath: string, id: string, payload: CreateFaqGroupPayload): Promise<FaqGroup> {
    return apiFetch<FaqGroup>(`${basePath}/${id}/faqs/groups`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(
    basePath: string,
    id: string,
    groupId: string,
    payload: UpdateFaqGroupPayload,
  ): Promise<FaqGroup> {
    return apiFetch<FaqGroup>(`${basePath}/${id}/faqs/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  remove(basePath: string, id: string, groupId: string): Promise<void> {
    return apiFetch<void>(`${basePath}/${id}/faqs/groups/${groupId}`, {
      method: 'DELETE',
    });
  },

  upsertTranslation(
    basePath: string,
    id: string,
    groupId: string,
    locale: Locale,
    payload: UpsertFaqTranslationPayload,
  ): Promise<FaqTranslation> {
    return apiFetch<FaqTranslation>(
      `${basePath}/${id}/faqs/groups/${groupId}/translations/${locale}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    );
  },
};
