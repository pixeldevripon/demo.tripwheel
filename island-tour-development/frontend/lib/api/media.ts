import type { MediaItem, MediaListResponse } from '@/types/media';

const BASE_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:5050'}/api/v1`;

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });

  if (!res.ok) {
    let message = `Request failed with status ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message)
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    } catch {
      // ignore json parse error
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const mediaApi = {
  async getAll(queryString = 'limit=100&page=1'): Promise<MediaItem[]> {
    const res = await apiFetch<MediaListResponse>(`/media-gallery?${queryString}`);
    return res.data;
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
