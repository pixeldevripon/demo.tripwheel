import type { Locale } from '@/lib/constants/locales';
import type {
  CreatePagePayload,
  PageDetail,
  PageListItem,
  PageStatus,
  UpdatePagePayload,
  UpsertPageTranslationPayload,
} from '@/types/pages';
import { apiFetch } from './fetch';

/**
 * The Pages system (legal/policy permalinks). All endpoints require
 * MANAGE_EDITORIAL (admin-only) - these are the site's own pages, the same
 * ownership as the homepage.
 */
export const pagesApi = {
  list(): Promise<PageListItem[]> {
    return apiFetch<PageListItem[]>('/pages');
  },

  get(id: string): Promise<PageDetail> {
    return apiFetch<PageDetail>(`/pages/${id}`);
  },

  create(payload: CreatePagePayload): Promise<PageDetail> {
    return apiFetch<PageDetail>('/pages', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  update(id: string, payload: UpdatePagePayload): Promise<PageDetail> {
    return apiFetch<PageDetail>(`/pages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  updateStatus(id: string, status: PageStatus): Promise<PageDetail> {
    return apiFetch<PageDetail>(`/pages/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  remove(id: string): Promise<{ message: string }> {
    return apiFetch<{ message: string }>(`/pages/${id}`, {
      method: 'DELETE',
    });
  },

  upsertTranslation(
    id: string,
    locale: Locale,
    payload: UpsertPageTranslationPayload,
  ): Promise<PageDetail['translations'][number]> {
    return apiFetch(`/pages/${id}/translations/${locale}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};
