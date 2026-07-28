import type { Locale } from '@/lib/constants/locales';
import type {
  CreatePageContentSectionPayload,
  PageContentSectionGroup,
  PageContentSectionTranslation,
  UpdatePageContentSectionPayload,
  UpsertPageContentSectionTranslationPayload,
} from '@/types/page-content-section';

import { apiFetch } from './fetch';

/**
 * Page-content-section client, shared across every entity that owns authored
 * heading + body blocks. `basePath` is the module segment (`/destinations` today);
 * `id` is the owning entity's id. Endpoint shape mirrors the grouped-FAQ client.
 *
 * Cache busting is automatic: every write here goes through `apiFetch`, whose
 * `revalidatePublicForPath` maps `/destinations/:id/...` to `destination:<id>` +
 * `destinations`, which is exactly what the public About band reads.
 */
export const pageContentSectionsApi = {
  list(basePath: string, id: string): Promise<PageContentSectionGroup[]> {
    return apiFetch<PageContentSectionGroup[]>(`${basePath}/${id}/content-sections`);
  },

  create(
    basePath: string,
    id: string,
    payload: CreatePageContentSectionPayload,
  ): Promise<PageContentSectionGroup> {
    return apiFetch<PageContentSectionGroup>(`${basePath}/${id}/content-sections`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(
    basePath: string,
    id: string,
    groupId: string,
    payload: UpdatePageContentSectionPayload,
  ): Promise<PageContentSectionGroup> {
    return apiFetch<PageContentSectionGroup>(
      `${basePath}/${id}/content-sections/${groupId}`,
      { method: 'PATCH', body: JSON.stringify(payload) },
    );
  },

  remove(basePath: string, id: string, groupId: string): Promise<void> {
    return apiFetch<void>(`${basePath}/${id}/content-sections/${groupId}`, {
      method: 'DELETE',
    });
  },

  upsertTranslation(
    basePath: string,
    id: string,
    groupId: string,
    locale: Locale,
    payload: UpsertPageContentSectionTranslationPayload,
  ): Promise<PageContentSectionTranslation> {
    return apiFetch<PageContentSectionTranslation>(
      `${basePath}/${id}/content-sections/${groupId}/translations/${locale}`,
      { method: 'PUT', body: JSON.stringify(payload) },
    );
  },

  /** Clear ONE locale (heading/body are NOT NULL - the row is removed). */
  deleteTranslation(
    basePath: string,
    id: string,
    groupId: string,
    locale: Locale,
  ): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(
      `${basePath}/${id}/content-sections/${groupId}/translations/${locale}`,
      { method: 'DELETE' },
    );
  },
};
