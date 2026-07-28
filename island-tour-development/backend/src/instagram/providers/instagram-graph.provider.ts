import { Injectable, Logger } from '@nestjs/common';
import { InstagramMediaType } from '@prisma/client';

import {
  type InstagramApiProvider,
  type InstagramMediaItem,
  type InstagramTokenResult,
} from './instagram-api.provider';

/**
 * Live "Instagram API with Instagram Login" client (verified against Meta's
 * current docs - the Basic Display API this replaces was retired). A native-
 * fetch thin client, same house style as the translation providers.
 *
 * Token-only: the admin pastes a long-lived token in the dashboard, so this
 * client never touches the OAuth authorize/exchange hosts - only graph.instagram.com:
 *   graph.instagram.com/me                 - resolve the account (id + handle)
 *   graph.instagram.com/{id}/media         - read the media list
 *   graph.instagram.com/refresh_access_token - keep the 60-day token alive
 */
const GRAPH_BASE = 'https://graph.instagram.com';
const MEDIA_FIELDS =
  'id,media_type,media_url,thumbnail_url,permalink,caption,timestamp';

/** Instagram's per-page media count; larger totals are reached by paginating. */
const PAGE_SIZE = 25;

/** Runaway guard on pagination (covers any allowed limit at PAGE_SIZE = 25). */
const MAX_PAGES = 5;

@Injectable()
export class InstagramGraphProvider implements InstagramApiProvider {
  private readonly logger = new Logger(InstagramGraphProvider.name);

  async refreshToken(accessToken: string): Promise<InstagramTokenResult> {
    const params = new URLSearchParams({
      grant_type: 'ig_refresh_token',
      access_token: accessToken,
    });
    const res = await this.getJson<{
      access_token: string;
      expires_in: number;
    }>(`${GRAPH_BASE}/refresh_access_token?${params.toString()}`);

    // The user id does not change on refresh; the caller keeps the stored one,
    // so an empty string here is fine (the token store ignores it on refresh).
    return {
      accessToken: res.access_token,
      userId: '',
      expiresInSeconds: res.expires_in,
    };
  }

  async resolveAccount(
    accessToken: string,
  ): Promise<{ userId: string; username: string | null }> {
    const params = new URLSearchParams({
      fields: 'user_id,username',
      access_token: accessToken,
    });
    const res = await this.getJson<{
      user_id?: string | number;
      id?: string;
      username?: string;
    }>(`${GRAPH_BASE}/me?${params.toString()}`);
    // `user_id` is the Instagram-scoped id used by /{id}/media; `id` is the
    // fallback the field returns on some app configs.
    const id = res.user_id ?? res.id;
    if (!id) throw new Error('Instagram /me returned no user id');
    return { userId: String(id), username: res.username?.trim() || null };
  }

  async fetchMedia(
    userId: string,
    accessToken: string,
    limit: number,
  ): Promise<InstagramMediaItem[]> {
    // Instagram caps a single media page at ~25, so to honour a larger `limit`
    // we follow the `paging.next` cursor page by page until we have enough (or
    // the account runs out). MAX_PAGES is a runaway guard - at PAGE_SIZE = 25 it
    // covers any limit the DTO allows (<= 50) with room to spare.
    const params = new URLSearchParams({
      fields: MEDIA_FIELDS,
      limit: String(Math.min(limit, PAGE_SIZE)),
      access_token: accessToken,
    });
    let url = `${GRAPH_BASE}/${userId}/media?${params.toString()}`;

    const collected: RawMedia[] = [];
    for (let page = 0; page < MAX_PAGES && collected.length < limit; page++) {
      const res = await this.getJson<{
        data?: RawMedia[];
        paging?: { next?: string };
      }>(url);
      const batch = res.data ?? [];
      collected.push(...batch);
      // Stop when Instagram has no further page or returned an empty one.
      if (batch.length === 0 || !res.paging?.next) break;
      url = res.paging.next;
    }

    return collected.slice(0, limit).map(flattenMedia);
  }

  // ── HTTP ────────────────────────────────────────────────────────────────────

  private async getJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    return this.parse<T>(res, url);
  }

  private async postJson<T>(url: string, body: URLSearchParams): Promise<T> {
    const res = await fetch(url, { method: 'POST', body });
    return this.parse<T>(res, url);
  }

  private async parse<T>(res: Response, url: string): Promise<T> {
    const text = await res.text();
    if (!res.ok) {
      // Log the STATUS + host, never the body: an error response can echo back
      // the code or token we just sent.
      const host = safeHost(url);
      this.logger.error(`Instagram API ${res.status} from ${host}`);
      throw new Error(`Instagram API responded ${res.status}`);
    }
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new Error('Instagram API returned a non-JSON body');
    }
  }
}

/** Instagram's on-the-wire media shape (a subset of the fields we request). */
interface RawMedia {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  permalink?: string;
  caption?: string;
  timestamp?: string;
}

/**
 * Flatten one wire object into what the sync consumes. For a VIDEO, `media_url`
 * is the reel and `thumbnail_url` the poster; for an image there is no
 * thumbnail. An unknown/absent `media_type` falls back to IMAGE - the safest
 * default, since it just means "no play badge, paint the still".
 */
function flattenMedia(raw: RawMedia): InstagramMediaItem {
  return {
    id: raw.id,
    mediaType: toMediaType(raw.media_type),
    mediaUrl: raw.media_url ?? '',
    posterUrl: raw.thumbnail_url,
    permalink: raw.permalink,
    caption: raw.caption,
    timestamp: raw.timestamp,
  };
}

function toMediaType(value?: string): InstagramMediaType {
  switch (value) {
    case 'VIDEO':
      return InstagramMediaType.VIDEO;
    case 'CAROUSEL_ALBUM':
      return InstagramMediaType.CAROUSEL_ALBUM;
    default:
      return InstagramMediaType.IMAGE;
  }
}

/** Host for a log line, without ever risking the query string (token/code). */
function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'instagram';
  }
}
