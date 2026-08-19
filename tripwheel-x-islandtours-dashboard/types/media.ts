import type { Locale } from '@/types/locale';

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

/**
 * One stored locale's copy for an asset (GET /media-gallery/:id/translations).
 *
 * English is never in this list: it lives on the `MediaItem` itself, which is
 * what every other locale falls back to field by field.
 */
export interface MediaTranslation {
  locale: Locale;
  title: string | null;
  description: string | null;
  altText: string | null;
  /**
   * True when the AI wrote this row. Saving from the dashboard always resets it
   * to false, and that reset is what stops the AI overwriting the edit later.
   */
  isMachineTranslated: boolean;
  updatedAt: string;
}

/**
 * PATCH /media-gallery/:id/translations/:locale body.
 *
 * An empty string CLEARS the field: the row survives, flagged human, and the
 * public page falls back to English for that field. Only the three translatable
 * fields - filename and the indexing flag belong to the asset, not to a language.
 */
export interface UpsertMediaTranslationInput {
  title?: string;
  description?: string;
  altText?: string;
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
