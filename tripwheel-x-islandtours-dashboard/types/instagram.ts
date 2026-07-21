// Mirrors backend: src/instagram/dto/instagram.dto.ts
// The brand Instagram grid on destination pages. Phase 1 is admin-curated;
// phase 2 adds API-synced tiles (source = 'API') to the same list.

export type InstagramSource = 'MANUAL' | 'API';
export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

export interface InstagramAccount {
  id: string;
  /** Handle without the leading '@'. */
  username: string | null;
  /** Explicit override; null means the public site derives it from the handle. */
  profileUrl: string | null;
}

export interface InstagramPost {
  id: string;
  source: InstagramSource;
  mediaType: InstagramMediaType;
  permalink: string | null;
  imageUrl: string;
  thumbnailUrl: string | null;
  caption: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  displayOrder: number;
  isActive: boolean;
  /** null = brand-wide (shown on every destination page). */
  destinationId: string | null;
  destinationName: string | null;
  postedAt: string | null;
  syncedAt: string | null;
}

export interface UpdateInstagramAccountPayload {
  username?: string;
  profileUrl?: string;
}

export interface CreateInstagramPostPayload {
  imageUrl: string;
  imagePublicId?: string;
  permalink?: string;
  caption?: string;
  altText?: string;
  mediaType?: InstagramMediaType;
  width?: number;
  height?: number;
  destinationId?: string;
  isActive?: boolean;
}

export interface UpdateInstagramPostPayload {
  imageUrl?: string;
  permalink?: string;
  caption?: string;
  altText?: string;
  destinationId?: string | null;
  isActive?: boolean;
}

export interface ReorderInstagramPostsPayload {
  items: { id: string; displayOrder: number }[];
}
