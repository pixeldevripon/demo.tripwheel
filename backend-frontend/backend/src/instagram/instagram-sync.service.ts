import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  InstagramMediaType,
  InstagramSource,
  InstagramSyncStatus,
} from '@prisma/client';

import { CloudinaryService } from '@/media-gallery/cloudinary.service';
import { PrismaService } from '@/prisma/prisma.service';

import { deleteInstagramMirror } from './instagram-mirror.util';
import {
  InstagramTokenService,
  REFRESH_WINDOW_MS,
} from './instagram-token.service';
import {
  INSTAGRAM_API_PROVIDER,
  type InstagramApiProvider,
  type InstagramMediaItem,
} from './providers/instagram-api.provider';

/**
 * Fallback for how many posts to pull per sync when the account row has no value
 * yet. Dashboard-configurable (InstagramAccount.syncFetchLimit); kept comfortably
 * above the largest display cap (gallery = 15) so the admin has spares to
 * reorder/hide. Older API rows beyond the fetched set drop out.
 */
const DEFAULT_FETCH_LIMIT = 24;

/**
 * Hard bounds on the fetch limit: 1..50. Instagram serves ~25 per page, so the
 * provider PAGINATES (follows the cursor) to reach counts above one page.
 */
const MIN_FETCH_LIMIT = 1;
const MAX_FETCH_LIMIT = 50;

const ACCOUNT_ID = 'default';

/** The Cloudinary subfolder mirrored Instagram assets land in. */
const MIRROR_FOLDER = 'instagram';

/** One run's outcome, returned to the manual "Sync now" endpoint. */
export interface InstagramSyncResult {
  ran: boolean;
  created: number;
  updated: number;
  removed: number;
  failed: number;
  status: InstagramSyncStatus;
  error: string | null;
}

/**
 * The heart of phase 2: pull the connected account's recent media, mirror each
 * asset into Cloudinary (Instagram's media_url CDN links expire in days and
 * hotlinking breaks their terms, so every tile must be an asset WE own), and
 * upsert it into the same InstagramPost rows the public grid already renders.
 *
 * Idempotent by igMediaId:
 *  - NEW post  -> mirror media, create a row appended to the grid.
 *  - SEEN post -> refresh only metadata (caption/permalink/type/postedAt). The
 *    media is already mirrored and permanent, and displayOrder + isActive are
 *    ADMIN-owned (reorder & hide), so a re-sync never clobbers curation.
 *  - GONE post -> an API row no longer in the recent set is deleted, and its
 *    mirrored Cloudinary assets cleaned up.
 */
@Injectable()
export class InstagramSyncService {
  private readonly logger = new Logger(InstagramSyncService.name);

  constructor(
    @Inject(INSTAGRAM_API_PROVIDER)
    private readonly provider: InstagramApiProvider,
    private readonly tokens: InstagramTokenService,
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  /**
   * Refresh the token if it is near expiry, then run one sync. Safe to call from
   * the cron and the manual endpoint alike: a missing connection is a clean
   * no-op, not an error, and every failure is recorded rather than thrown so the
   * worker never dies on a bad night.
   */
  async syncNow(): Promise<InstagramSyncResult> {
    const credential = await this.tokens.readCredential();
    if (!credential) {
      // Nothing connected (or the token no longer decrypts). Not an error - the
      // feed simply keeps whatever tiles it has.
      return empty(InstagramSyncStatus.OK);
    }

    let accessToken = credential.accessToken;

    // Keep the 60-day token alive: refresh once it is inside the window. A
    // failing refresh is surfaced as EXPIRING but we still TRY the sync with the
    // current token, which is valid until it actually lapses. We DON'T record
    // the status here - the successful reconcile at the end would overwrite it,
    // flipping the panel back to a green "Synced" every night the refresh fails
    // and hiding the early warning. Instead we remember it and fold it into the
    // single final recordSyncResult below.
    let refreshError: string | null = null;
    if (needsRefresh(credential.tokenExpiresAt)) {
      try {
        const refreshed = await this.provider.refreshToken(accessToken);
        await this.tokens.saveRefreshedToken(refreshed);
        accessToken = refreshed.accessToken;
      } catch (err) {
        refreshError = `Token refresh failed - reconnect before it expires: ${errorMessage(err)}`;
        this.logger.error(refreshError);
      }
    }

    // Keep the section handle in step with the connected account (auto-derived,
    // never typed). Best-effort - a handle hiccup must not fail the sync.
    try {
      const account = await this.provider.resolveAccount(accessToken);
      await this.tokens.storeUsername(account.username);
    } catch {
      // Leave the stored handle as-is.
    }

    let media: InstagramMediaItem[];
    try {
      media = await this.provider.fetchMedia(
        credential.igUserId,
        accessToken,
        await this.resolveFetchLimit(),
      );
    } catch (err) {
      const message = errorMessage(err);
      this.logger.error(`Instagram media fetch failed: ${message}`);
      await this.tokens.recordSyncResult(InstagramSyncStatus.FAILED, message);
      return { ...empty(InstagramSyncStatus.FAILED), error: message };
    }

    let result: InstagramSyncResult;
    try {
      result = await this.reconcile(media);
    } catch (err) {
      // A DB error mid-reconcile must still land as a recorded FAILED run, not a
      // raw throw that leaves lastSyncStatus stale (cron) or 500s (manual).
      const message = errorMessage(err);
      this.logger.error(`Instagram reconcile failed: ${message}`);
      await this.tokens.recordSyncResult(InstagramSyncStatus.FAILED, message);
      return { ...empty(InstagramSyncStatus.FAILED), error: message };
    }

    // A refresh failure this run outranks a clean reconcile: the token is on its
    // way out and the admin needs to reconnect, even though today's sync worked.
    const status = refreshError ? InstagramSyncStatus.EXPIRING : result.status;
    const error = refreshError ?? result.error;
    await this.tokens.recordSyncResult(status, error);
    this.logger.log(
      `Instagram sync: +${result.created} ~${result.updated} -${result.removed} (failed ${result.failed})`,
    );
    return { ...result, status, error };
  }

  /**
   * Bring the API rows in line with the fetched media set. Mirrors new posts,
   * refreshes seen ones, deletes vanished ones. A per-item mirror failure is
   * counted (PARTIAL) rather than aborting the whole run.
   */
  private async reconcile(
    media: InstagramMediaItem[],
  ): Promise<InstagramSyncResult> {
    const existing = await this.prisma.instagramPost.findMany({
      where: { source: InstagramSource.API },
      select: {
        id: true,
        igMediaId: true,
        imagePublicId: true,
        videoPublicId: true,
      },
    });
    const bySeenId = new Map(
      existing.filter((r) => r.igMediaId).map((r) => [r.igMediaId!, r]),
    );

    const fetchedIds = new Set(media.map((m) => m.id));
    let created = 0;
    let updated = 0;
    let failed = 0;

    // Append new tiles after the current highest displayOrder, keeping newest
    // Instagram posts first WITHIN the newly added block.
    const tail = await this.prisma.instagramPost.aggregate({
      _max: { displayOrder: true },
    });
    let nextOrder = (tail._max.displayOrder ?? -1) + 1;

    for (const item of media) {
      const seen = bySeenId.get(item.id);
      if (seen) {
        // Metadata only - the media is already mirrored and permanent. This
        // assumes a post's media_type never changes for a given igMediaId (true
        // on Instagram: a published post's type is fixed), so refreshing
        // mediaType here without re-mirroring can't strand a VIDEO row without a
        // video.
        await this.prisma.instagramPost.update({
          where: { id: seen.id },
          data: {
            mediaType: item.mediaType,
            permalink: item.permalink?.trim() || '',
            caption: item.caption?.trim() || null,
            postedAt: parseTimestamp(item.timestamp),
            syncedAt: new Date(),
          },
        });
        updated += 1;
        continue;
      }

      try {
        const mirrored = await this.mirror(item);
        await this.prisma.instagramPost.create({
          data: {
            source: InstagramSource.API,
            igMediaId: item.id,
            mediaType: item.mediaType,
            imageUrl: mirrored.imageUrl,
            imagePublicId: mirrored.imagePublicId,
            videoUrl: mirrored.videoUrl,
            videoPublicId: mirrored.videoPublicId,
            width: mirrored.width ?? null,
            height: mirrored.height ?? null,
            permalink: item.permalink?.trim() || '',
            caption: item.caption?.trim() || null,
            postedAt: parseTimestamp(item.timestamp),
            syncedAt: new Date(),
            displayOrder: nextOrder,
          },
        });
        nextOrder += 1;
        created += 1;
      } catch (err) {
        // One bad asset must not sink the run - skip it, count it, keep going.
        failed += 1;
        this.logger.error(
          `Instagram mirror failed for media ${item.id}: ${errorMessage(err)}`,
        );
      }
    }

    // Delete API rows that fell out of the recent set, cleaning their mirrors.
    // Per-row isolation: one failed delete/cleanup must not abort the rest of
    // the loop and skip the run's status record.
    const gone = existing.filter(
      (r) => !r.igMediaId || !fetchedIds.has(r.igMediaId),
    );
    let removed = 0;
    for (const row of gone) {
      try {
        await this.prisma.instagramPost.delete({ where: { id: row.id } });
        await this.cleanupMirror(row.imagePublicId, row.videoPublicId);
        removed += 1;
      } catch (err) {
        failed += 1;
        this.logger.error(
          `Instagram tile cleanup failed for ${row.id}: ${errorMessage(err)}`,
        );
      }
    }

    const status =
      failed === 0
        ? InstagramSyncStatus.OK
        : created + updated > 0
          ? InstagramSyncStatus.PARTIAL
          : InstagramSyncStatus.FAILED;

    return {
      ran: true,
      created,
      updated,
      removed,
      failed,
      status,
      error: failed > 0 ? `${failed} item(s) failed` : null,
    };
  }

  /**
   * Mirror one media item into Cloudinary. A video becomes poster + video (its
   * still doubles as the grid poster and the reduced-motion frame); an image
   * becomes just the still. Falls back to a Cloudinary-generated poster when a
   * reel arrives without a thumbnail.
   */
  private async mirror(item: InstagramMediaItem): Promise<{
    imageUrl: string;
    imagePublicId: string;
    videoUrl: string | null;
    videoPublicId: string | null;
    width?: number;
    height?: number;
  }> {
    if (item.mediaType === InstagramMediaType.VIDEO) {
      const video = await this.cloudinary.uploadFromUrl(
        item.mediaUrl,
        MIRROR_FOLDER,
      );
      const posterSource =
        item.posterUrl || this.cloudinary.videoPosterUrl(video.publicId);
      const poster = await this.cloudinary.uploadFromUrl(
        posterSource,
        MIRROR_FOLDER,
      );
      return {
        imageUrl: poster.url,
        imagePublicId: poster.publicId,
        videoUrl: video.url,
        videoPublicId: video.publicId,
        width: poster.width,
        height: poster.height,
      };
    }

    const image = await this.cloudinary.uploadFromUrl(
      item.mediaUrl,
      MIRROR_FOLDER,
    );
    return {
      imageUrl: image.url,
      imagePublicId: image.publicId,
      videoUrl: null,
      videoPublicId: null,
      width: image.width,
      height: image.height,
    };
  }

  /**
   * The dashboard-configured posts-per-sync, clamped to a safe page size. A
   * missing/out-of-range value falls back to the default so a bad row can never
   * make the fetch ask Instagram for 0 or an absurd count.
   */
  private async resolveFetchLimit(): Promise<number> {
    const row = await this.prisma.instagramAccount.findUnique({
      where: { id: ACCOUNT_ID },
      select: { syncFetchLimit: true },
    });
    const n = row?.syncFetchLimit ?? DEFAULT_FETCH_LIMIT;
    return Math.min(MAX_FETCH_LIMIT, Math.max(MIN_FETCH_LIMIT, n));
  }

  /** Best-effort Cloudinary cleanup for a removed tile (never throws). */
  private cleanupMirror(
    imagePublicId: string | null,
    videoPublicId: string | null,
  ): Promise<void> {
    return deleteInstagramMirror(this.cloudinary, imagePublicId, videoPublicId);
  }
}

// ── helpers ─────────────────────────────────────────────────────────────────

function needsRefresh(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - Date.now() < REFRESH_WINDOW_MS;
}

function parseTimestamp(value?: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function empty(status: InstagramSyncStatus): InstagramSyncResult {
  return {
    ran: false,
    created: 0,
    updated: 0,
    removed: 0,
    failed: 0,
    status,
    error: null,
  };
}
