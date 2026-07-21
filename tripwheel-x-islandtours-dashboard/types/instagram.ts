// Mirrors backend: src/instagram/dto/instagram.dto.ts
// The brand Instagram grid on destination pages. Phase 1 is admin-curated;
// phase 2 adds API-synced tiles (source = 'API') to the same list.

export type InstagramSource = 'MANUAL' | 'API';

/**
 * Which public layout draws the tiles.
 *   GRID    - the curated band: rounded cards, generous gutters, 6 tiles.
 *   GALLERY - the Instagram profile look: 4:5 portraits, hairline gutters, 18.
 */
export type InstagramLayout = 'GRID' | 'GALLERY';
export type InstagramMediaType = 'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM';

export interface InstagramAccount {
  id: string;
  /** Handle without the leading '@'. */
  username: string | null;
  /** Explicit override; null means the public site derives it from the handle. */
  profileUrl: string | null;
  layout: InstagramLayout;
}

export interface InstagramPost {
  id: string;
  source: InstagramSource;
  mediaType: InstagramMediaType;
  permalink: string | null;
  /** On a video tile this is the poster. */
  imageUrl: string;
  /** Null on a photo tile. Present means mediaType is VIDEO. */
  videoUrl: string | null;
  caption: string | null;
  altText: string | null;
  width: number | null;
  height: number | null;
  displayOrder: number;
  isActive: boolean;
  /** Badge only - pinning never reorders the grid. */
  isPinned: boolean;
  /** null = brand-wide (shown on every destination page). */
  destinationId: string | null;
  destinationName: string | null;
  postedAt: string | null;
  syncedAt: string | null;
}

export interface UpdateInstagramAccountPayload {
  username?: string;
  profileUrl?: string;
  layout?: InstagramLayout;
}

// VIDEO is never sent: the backend derives it from `videoUrl`, so a tile cannot
// claim to be a reel without one. IMAGE vs CAROUSEL_ALBUM IS ours to send - it
// describes the linked post, which we cannot see from the tile.
export type InstagramBadgeType = 'IMAGE' | 'CAROUSEL_ALBUM';

export interface CreateInstagramPostPayload {
  imageUrl: string;
  videoUrl?: string;
  imagePublicId?: string;
  permalink?: string;
  caption?: string;
  altText?: string;
  mediaType?: InstagramBadgeType;
  isPinned?: boolean;
  width?: number;
  height?: number;
  destinationId?: string;
  isActive?: boolean;
}

export interface UpdateInstagramPostPayload {
  imageUrl?: string;
  /** Empty string clears the video and turns the tile back into a photo. */
  videoUrl?: string;
  permalink?: string;
  caption?: string;
  altText?: string;
  mediaType?: InstagramBadgeType;
  isPinned?: boolean;
  destinationId?: string | null;
  isActive?: boolean;
}

export interface ReorderInstagramPostsPayload {
  items: { id: string; displayOrder: number }[];
}
