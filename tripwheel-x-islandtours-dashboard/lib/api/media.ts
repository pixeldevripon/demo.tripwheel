import type { Locale } from '@/types/locale';
import type {
  MediaItem,
  MediaListResponse,
  MediaSort,
  MediaTranslation,
  MediaTypeFilter,
  UpdateMediaInput,
  UpsertMediaTranslationInput,
} from '@/types/media';

import { apiFetch } from './fetch';

export const mediaApi = {
  // Returns the full pagination envelope (total/page/limit) so the gallery can
  // page through the whole library instead of capping at the first 100 items.
  getPage(
    page: number,
    limit: number,
    sort?: MediaSort,
    type?: MediaTypeFilter,
    untranslated?: Locale | 'none',
  ): Promise<MediaListResponse> {
    const params = new URLSearchParams({ limit: String(limit), page: String(page) });
    if (sort) {
      params.set('sortBy', sort.sortBy);
      params.set('sortOrder', sort.sortOrder);
    }
    if (type && type !== 'all') params.set('type', type);
    // 'none' means no filter; 'en' would be meaningless (English lives on the
    // asset row, so no asset ever has an English translation row) and the
    // backend ignores it - the picker does not offer it either.
    if (untranslated && untranslated !== 'none' && untranslated !== 'en') {
      params.set('untranslated', untranslated);
    }
    return apiFetch<MediaListResponse>(`/media-gallery?${params.toString()}`);
  },

  update(id: string, dto: UpdateMediaInput): Promise<MediaItem> {
    return apiFetch<MediaItem>(`/media-gallery/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
  },

  /**
   * Every stored locale for one asset. No locale param by design - the switcher
   * needs them all at once, and the backend route deliberately takes none.
   */
  getTranslations(id: string): Promise<MediaTranslation[]> {
    return apiFetch<MediaTranslation[]>(`/media-gallery/${id}/translations`);
  },

  /**
   * Save one locale's copy. Empty strings clear the field (the row survives, so
   * the clear sticks against the AI refresher). `en` is rejected by the backend -
   * English is edited through `update()` on the asset itself.
   */
  upsertTranslation(
    id: string,
    locale: Locale,
    dto: UpsertMediaTranslationInput,
  ): Promise<MediaTranslation> {
    return apiFetch<MediaTranslation>(
      `/media-gallery/${id}/translations/${locale}`,
      { method: 'PATCH', body: JSON.stringify(dto) },
    );
  },

  /**
   * Translate ONE asset into ONE locale now. Lives under `/media-gallery/...`
   * rather than the generic content-translation path for two reasons: the
   * backend checks the media scope there, and the dashboard's path-shaped
   * cache-revalidation maps `media-gallery` writes to the media tags for free.
   *
   * `force` re-translates a human-saved row - only after an explicit confirm.
   */
  generateTranslation(
    id: string,
    locale: Locale,
    force = false,
  ): Promise<{ written: number; skipped: number; reason?: string }> {
    return apiFetch(
      `/media-gallery/${id}/translations/${locale}/generate${force ? '?force=true' : ''}`,
      { method: 'POST' },
    );
  },

  delete(id: string): Promise<void> {
    return apiFetch<void>(`/media-gallery/${id}`, { method: 'DELETE' });
  },

  bulkDelete(ids: string[]): Promise<{ deleted: number }> {
    return apiFetch<{ deleted: number; failed: number }>('/media-gallery/bulk', {
      method: 'DELETE',
      body: JSON.stringify({ ids }),
    });
  },

  upload(files: File[]): Promise<MediaItem[]> {
    const formData = new FormData();
    for (const file of files) formData.append('files', file);
    // No Content-Type header - browser sets multipart/form-data boundary automatically
    return apiFetch<MediaItem[]>('/media-gallery/upload', {
      method: 'POST',
      headers: {},
      body: formData,
    });
  },

  getSignedParams(): Promise<{ signature: string; timestamp: number; cloudName: string; apiKey: string; folder?: string }> {
    return apiFetch('/media-gallery/sign');
  },

  confirmUpload(dto: { publicId: string; url: string; resourceType: string }): Promise<MediaItem> {
    return apiFetch<MediaItem>('/media-gallery/confirm', {
      method: 'POST',
      body: JSON.stringify(dto),
    });
  },
};
