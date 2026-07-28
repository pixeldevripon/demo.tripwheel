// Mirrors backend: src/instagram/dto/instagram.dto.ts
// The brand Instagram grid on destination pages. Phase 2 (auto-sync) is the only
// path now: an admin connects the account and a daily job mirrors the feed into
// these tiles. The only per-tile curation left is reorder + hide (+ alt/island).

export type InstagramSource = 'MANUAL' | 'API';
export type InstagramSyncStatus = 'OK' | 'PARTIAL' | 'FAILED' | 'EXPIRING';

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
  /** How many recent posts each sync pulls (1..25). */
  syncFetchLimit: number;
  /** Minutes between automatic syncs (180 / 360 / 720 / 1440). */
  syncIntervalMinutes: number;
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

/**
 * The account form carries the layout and the sync tuning; handle + link are
 * auto-derived, so they are not here.
 */
export interface UpdateInstagramAccountPayload {
  layout?: InstagramLayout;
  syncFetchLimit?: number;
  syncIntervalMinutes?: number;
}

/**
 * Curation of a SYNCED tile - the only edits left. Media, caption and permalink
 * belong to the sync (a re-run reverts any edit), so they are not here.
 */
export interface UpdateInstagramPostPayload {
  altText?: string;
  /** null moves the tile back to brand-wide. */
  destinationId?: string | null;
  /** Hide a tile from the public grid without deleting it. */
  isActive?: boolean;
}

export interface ReorderInstagramPostsPayload {
  items: { id: string; displayOrder: number }[];
}

/** The connection state the panel renders - never the token. */
export interface InstagramConnection {
  /** True once an access token is configured (dashboard or env fallback). */
  connected: boolean;
  igUserId: string | null;
  tokenExpiresAt: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: InstagramSyncStatus | null;
  lastSyncError: string | null;
}

/** Non-secret view of the access token credential for the dashboard form. */
export interface InstagramCredentialStatus {
  hasAccessToken: boolean;
  isConfigured: boolean;
}

/** Save the access token. Omit to leave it unchanged; '' clears it. */
export interface SaveInstagramCredentialsPayload {
  accessToken?: string;
}

/** One sync run's tally, returned by "Sync now". */
export interface InstagramSyncResult {
  ran: boolean;
  created: number;
  updated: number;
  removed: number;
  failed: number;
  status: InstagramSyncStatus;
  error: string | null;
}
