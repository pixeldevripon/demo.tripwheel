export interface MediaItem {
  id: string;
  url: string;
  publicId: string;
  resourceType: string;
  uploadedAt: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  fileName?: string;
  altText?: string;
  caption?: string;
  originalName?: string | null;
  thumbnail?: string;
  width?: number;
  height?: number;
  size?: number;
  mimeType?: string | null;
  bytes?: number | null;
  format?: string | null;
  title?: string | null;
  description?: string | null;
  excludeFromIndexing?: boolean;
}

/** PATCH /media-gallery/:id body - editable attachment metadata. */
export interface UpdateMediaInput {
  title?: string;
  description?: string;
  altText?: string;
  fileName?: string;
  excludeFromIndexing?: boolean;
}

/** Mirrors the backend MediaGalleryQueryDto sort params. */
export type MediaSortBy = 'uploadedAt' | 'name' | 'size' | 'type';
export type MediaSortOrder = 'asc' | 'desc';

export interface MediaSort {
  sortBy: MediaSortBy;
  sortOrder: MediaSortOrder;
}

export const DEFAULT_MEDIA_SORT: MediaSort = {
  sortBy: 'uploadedAt',
  sortOrder: 'desc',
};

/** Mirrors the backend media-type filter. */
export type MediaTypeFilter = 'all' | 'image' | 'video' | 'audio' | 'svg';

export interface MediaListResponse {
  data: MediaItem[];
  total: number;
  page: number;
  limit: number;
}
