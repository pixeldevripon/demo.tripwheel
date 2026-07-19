import type {
  MediaItem,
  MediaListResponse,
  MediaSort,
  MediaTypeFilter,
  UpdateMediaInput,
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
  ): Promise<MediaListResponse> {
    const params = new URLSearchParams({ limit: String(limit), page: String(page) });
    if (sort) {
      params.set('sortBy', sort.sortBy);
      params.set('sortOrder', sort.sortOrder);
    }
    if (type && type !== 'all') params.set('type', type);
    return apiFetch<MediaListResponse>(`/media-gallery?${params.toString()}`);
  },

  update(id: string, dto: UpdateMediaInput): Promise<MediaItem> {
    return apiFetch<MediaItem>(`/media-gallery/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(dto),
    });
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
