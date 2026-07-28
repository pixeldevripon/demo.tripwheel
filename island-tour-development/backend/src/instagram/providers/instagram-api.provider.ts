import { InstagramMediaType } from '@prisma/client';

/**
 * DI token for the Instagram API provider (the live Graph client). It is a seam
 * so the sync depends on an interface, not on `fetch` - the sync job and token
 * service consume this without knowing the transport.
 */
export const INSTAGRAM_API_PROVIDER = Symbol('INSTAGRAM_API_PROVIDER');

/** A long-lived token plus the account it belongs to and when it lapses. */
export interface InstagramTokenResult {
  /** The 60-day long-lived access token, PLAINTEXT - the caller encrypts it. */
  accessToken: string;
  /** Instagram-scoped user id; the media list is read from /{userId}/media. */
  userId: string;
  /** Seconds until the token expires (Instagram returns ~5.18M for 60 days). */
  expiresInSeconds: number;
}

/**
 * One media object as the SYNC needs it - already flattened from Instagram's
 * wire shape (which nests differently for video vs image). `mediaUrl` is the
 * asset to mirror; `posterUrl` is the still for a video (Instagram's
 * `thumbnail_url`). Both are expiring CDN links, never stored as-is.
 */
export interface InstagramMediaItem {
  /** Instagram's media id - the upsert key, so a re-sync updates not duplicates. */
  id: string;
  mediaType: InstagramMediaType;
  /** The image, or the video file for a VIDEO/reel. Expires within days. */
  mediaUrl: string;
  /** VIDEO only: the poster still (Instagram `thumbnail_url`). */
  posterUrl?: string;
  /** The public post URL the tile links out to. */
  permalink?: string;
  caption?: string;
  /** ISO-8601 creation time; becomes the tile's `postedAt`. */
  timestamp?: string;
}

/**
 * What the Instagram provider must offer for the token-only sync of "Instagram
 * API with Instagram Login". The admin pastes a long-lived token in the
 * dashboard; from there the sync only ever needs to keep it alive and read the
 * account's media:
 *
 *   resolveAccount (id + handle) -> fetchMedia
 *                          \-> refreshToken (daily, keeps the 60-day token alive)
 *
 * There is no OAuth here (no authorize/exchange) - the token IS the credential.
 *
 * Error contract: every method THROWS on failure (expired/revoked token,
 * network/API error). The sync job records it in `lastSyncError` and moves on
 * rather than crashing the worker.
 */
export interface InstagramApiProvider {
  /**
   * Refresh a long-lived token for another 60 days. Instagram requires it to be
   * at least 24h old and unexpired; the caller only invokes this inside the
   * refresh window, so a throw here means the connection needs re-authorising.
   */
  refreshToken(accessToken: string): Promise<InstagramTokenResult>;

  /**
   * The account a token belongs to (`GET /me?fields=user_id,username`): its
   * Instagram-scoped id (to read `/{userId}/media`) and its handle (shown in the
   * section header, so it is never typed by hand). Throws if the token is
   * invalid. `username` may be null if the field is withheld.
   */
  resolveAccount(
    accessToken: string,
  ): Promise<{ userId: string; username: string | null }>;

  /**
   * The account's most-recent media, newest first, already flattened. `limit`
   * caps how many are fetched (the sync asks for a little over the display cap).
   */
  fetchMedia(
    userId: string,
    accessToken: string,
    limit: number,
  ): Promise<InstagramMediaItem[]>;
}
