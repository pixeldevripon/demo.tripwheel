import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import { resolveOperatorId } from '@/common/utils/operator.util';
import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Permission, Role } from '@prisma/client';
import type { MediaGallery, Prisma } from '@prisma/client';
import { CloudinaryService } from './cloudinary.service';
import type { Multer } from 'multer';

import { Locale } from '@/common/constants/locales';
import { orBase } from '@/common/utils/translation.util';
import { ContentTranslationEnqueuer } from '@/content-translation/content-translation.enqueuer';
import { ContentTranslationService } from '@/content-translation/content-translation.service';
import { toTranslationHttpError } from '@/content-translation/translation-http-error';

import type {
  ConfirmUploadDto,
  MediaGalleryQueryDto,
  MediaSeoResponseDto,
  UpdateMediaDto,
  UpsertMediaTranslationDto,
} from './dto/upload-media.dto';

/** A Cloudinary URL without its `?_a=` analytics tail. See `getSeo`. */
function stripQuery(url: string): string {
  return url.split('?')[0];
}

/**
 * Field-value normalizer for every media metadata write: `undefined` means "not
 * in this payload, leave it alone", an empty/whitespace string means "clear it".
 */
function clean(v: string | undefined): string | null | undefined {
  return v === undefined ? undefined : v.trim() === '' ? null : v.trim();
}

/** The session identity every media call is scoped by. */
export type MediaActor = { id: string; role: Role };

/**
 * MediaGalleryService - all database and Cloudinary orchestration logic.
 *
 * ## Upload strategies supported
 * 1. Server-side sequential upload  (uploadFiles)
 * 2. Signed params for direct client upload (getSignedUploadParams)
 * 3. Confirm direct upload after client finishes (confirmUpload)
 *
 * ## Rollback contract
 * Each file is uploaded to Cloudinary, then immediately written to Prisma.
 * If the DB write fails, the just-uploaded Cloudinary asset is deleted so we
 * never have orphaned cloud assets.  Earlier successful records are kept
 * (partial success is acceptable - return only what was saved).
 */
@Injectable()
export class MediaGalleryService {
  private readonly logger = new Logger(MediaGalleryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
    private readonly staffPermissions: StaffPermissionsService,
    // Both from the @Global ContentTranslationModule - no module import needed.
    private readonly contentTranslation: ContentTranslationEnqueuer,
    private readonly contentTranslationService: ContentTranslationService,
  ) {}

  // ─── Operator-context scoping (conflict #6 stage 2) ─────────────────────────

  /**
   * The operator whose shared library a row should belong to: an operator
   * owner or team seat resolves to their operator id; platform accounts
   * (admin/staff/editor) upload PLATFORM assets (null). Never auto-provisions
   * an operator (that path is for tour ownership, not media).
   */
  private async operatorContextFor(actor: MediaActor): Promise<string | null> {
    if (actor.role !== Role.TOUR_OPERATOR) return null;
    return resolveOperatorId(this.prisma, actor.id, actor.role);
  }

  /** Public wrapper for the async-upload enqueue path (controller stamps the job payload). */
  operatorContextForUser(actor: MediaActor): Promise<string | null> {
    return this.operatorContextFor(actor);
  }

  /**
   * Row-visibility scope. Platform roles holding MANAGE_MEDIA (admin/staff/
   * editor content teams) see the WHOLE library; an operator context (owner
   * or any seat) sees the operator's shared library; anyone else is pinned
   * to rows they personally uploaded.
   */
  private async mediaScope(
    actor: MediaActor,
  ): Promise<Prisma.MediaGalleryWhereInput> {
    // EFFECTIVE permissions, never the static role table: MANAGE_MEDIA sits
    // inside the platform-staff ceiling, so a designation can grant or revoke
    // it per seat. Reading ROLE_PERMISSIONS here would hand every Role.STAFF
    // account the whole library regardless of what an admin actually granted.
    const effective = await this.staffPermissions.getEffectivePermissions({
      id: actor.id,
      role: actor.role,
    });
    if (effective.includes(Permission.MANAGE_MEDIA)) {
      return {};
    }
    if (actor.role === Role.TOUR_OPERATOR) {
      const operatorId = await this.operatorContextFor(actor);
      // Orphan fallback: rows the backfill could not attribute (operatorId
      // null) stay reachable by the person who uploaded them, so media never
      // silently vanishes from an operator's own library.
      return {
        OR: [{ operatorId }, { operatorId: null, userId: actor.id }],
      };
    }
    return { userId: actor.id };
  }

  // ─── Server-side upload ──────────────────────────────────────────────────────

  /**
   * Upload an array of Multer files one-by-one.
   * On DB failure after a successful Cloudinary upload, the cloud asset is
   * rolled back before re-throwing.  Files already committed remain saved.
   */
  async uploadFiles(
    files: Express.Multer.File[],
    actor: MediaActor,
  ): Promise<MediaGallery[]> {
    const userId = actor.id;
    const operatorId = await this.operatorContextFor(actor);
    // 1. Upload all files to Cloudinary in parallel
    const cloudResults = await Promise.allSettled(
      files.map((file) => this.cloudinaryService.uploadFile(file, userId)),
    );

    const succeeded: {
      publicId: string;
      url: string;
      resourceType: string;
      bytes?: number;
      format?: string;
      width?: number;
      height?: number;
      originalName: string;
      mimeType: string;
    }[] = [];
    const failed: string[] = [];

    for (let i = 0; i < cloudResults.length; i++) {
      const r = cloudResults[i];
      if (r.status === 'fulfilled') {
        succeeded.push({
          ...r.value,
          originalName: files[i].originalname,
          mimeType: files[i].mimetype,
        });
      } else {
        this.logger.error(
          `Cloudinary upload failed for ${files[i].originalname}: ${r.reason}`,
        );
        failed.push(files[i].originalname);
      }
    }

    if (succeeded.length === 0) {
      throw new Error(`All uploads failed: ${failed.join(', ')}`);
    }

    // 2. Batch DB write in a transaction - returns records, no second query needed
    try {
      return await this.prisma.$transaction(
        succeeded.map((r) =>
          this.prisma.mediaGallery.create({
            data: {
              url: r.url,
              publicId: r.publicId,
              resourceType: r.resourceType,
              originalName: r.originalName,
              mimeType: r.mimeType,
              bytes: r.bytes,
              format: r.format,
              width: r.width,
              height: r.height,
              userId,
              operatorId,
            },
          }),
        ),
      );
    } catch (err) {
      this.logger.warn(
        `Batch DB write failed, rolling back ${succeeded.length} Cloudinary assets`,
      );
      await Promise.allSettled(
        succeeded.map((r) => this.cloudinaryService.deleteFile(r.publicId)),
      );
      throw err;
    }
  }
  // ─── Signed upload flow (direct client → Cloudinary) ────────────────────────

  /**
   * Generate HMAC-signed parameters the client sends directly to Cloudinary.
   * No file bytes reach the NestJS server. Folder-path signing only - no DB
   * row and therefore no authorization decision happens here; the operator
   * stamp is applied in confirmUpload, which takes the full actor.
   */
  getSignedUploadParams(userId: string) {
    return this.cloudinaryService.generateSignedUploadParams(userId);
  }

  /**
   * Confirm a completed direct upload by verifying the asset exists in
   * Cloudinary and then saving the record to the DB.
   */
  async confirmUpload(
    dto: ConfirmUploadDto,
    actor: MediaActor,
  ): Promise<MediaGallery> {
    const userId = actor.id;
    const operatorId = await this.operatorContextFor(actor);
    // Verify the asset actually exists on Cloudinary (prevents spoofed publicIds)
    let asset: Awaited<
      ReturnType<typeof this.cloudinaryService.verifyAssetExists>
    >;
    try {
      asset = await this.cloudinaryService.verifyAssetExists(dto.publicId);
    } catch {
      throw new NotFoundException(
        `Cloudinary asset not found for publicId: ${dto.publicId}`,
      );
    }

    const record = await this.prisma.mediaGallery.create({
      data: {
        url: this.cloudinaryService.getOptimizedUrl(
          dto.publicId,
          dto.resourceType,
          { bytes: asset.bytes, width: asset.width, format: asset.format },
        ),
        publicId: dto.publicId,
        resourceType: dto.resourceType,
        bytes: asset.bytes,
        format: asset.format,
        width: asset.width,
        height: asset.height,
        userId,
        operatorId,
      },
    });

    this.logger.log(`Confirmed direct upload ${record.id} for user ${userId}`);

    return record;
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  /**
   * Platform-wide list of media URLs flagged excludeFromIndexing. Public -
   * consumed by the public site's SEO layer (og:image / structured data /
   * image sitemap filtering). URL-only payload; no owner data leaks.
   */
  async getExcludedUrls(): Promise<string[]> {
    const rows = await this.prisma.mediaGallery.findMany({
      where: { excludeFromIndexing: true },
      select: { url: true },
    });
    return rows.map((r) => r.url);
  }

  /**
   * Localized SEO copy for a batch of image URLs. Public - consumed by the
   * public site's `getMediaSeo`, which captions og:image, gallery photos beyond
   * the first, and hero images in the visitor's language.
   *
   * ## Why URLs and not ids
   * Entity tables store a bare image URL (`heroImage`, `ogImage`, `TourImage.url`)
   * and no media id, so the URL is the only join key the caller has. Picking an
   * image copies the URL out of the library; nothing links back.
   *
   * ## Matching ignores the query string
   * Every stored Cloudinary URL carries an `?_a=…` analytics param, and the copy
   * on an entity row and the copy in the library are not guaranteed to carry the
   * SAME one - so an exact-string match silently returns nothing. Both sides are
   * compared query-stripped.
   *
   * The predicate is `url = <stripped>` OR `url LIKE '<stripped>?%'` rather than
   * a bare prefix match: `.../hero` is a prefix of `.../hero-bg`, so
   * `startsWith(stripped)` would hand one asset's copy to a different image.
   *
   * ## Fallback is PER FIELD
   * A locale row may exist with only some fields filled - either never
   * translated, or deliberately cleared in the dashboard (stored as null, row
   * kept). Each field therefore falls back to the English base row on its own
   * via `orBase`. Taking the locale row wholesale would render a cleared field
   * blank instead of showing English, which is the bug class task #143 fixed.
   *
   * Rows flagged `excludeFromIndexing` are NOT filtered out here: alt text is an
   * accessibility need on every image, indexable or not. Only SEO surfaces
   * filter, and they already do it through `filterIndexableImages`.
   */
  async getSeo(
    urls: string[],
    locale: Locale = Locale.en,
  ): Promise<MediaSeoResponseDto[]> {
    // De-duplicate: a page can render the same asset as both hero and gallery
    // tile, and there is no reason to widen the query for it.
    const stripped = [...new Set(urls.map(stripQuery))];
    if (stripped.length === 0) return [];

    const rows = await this.prisma.mediaGallery.findMany({
      where: {
        OR: stripped.flatMap((url) => [
          { url },
          { url: { startsWith: `${url}?` } },
        ]),
      },
      select: {
        url: true,
        title: true,
        description: true,
        altText: true,
        ...(locale === Locale.en
          ? {}
          : {
              translations: {
                where: { locale },
                select: { title: true, description: true, altText: true },
              },
            }),
      },
    });

    return rows.map((row) => {
      const t =
        'translations' in row
          ? (row.translations?.[0] ?? undefined)
          : undefined;
      return {
        url: stripQuery(row.url),
        // `orBase` treats a blank string as "say nothing", so a field cleared to
        // '' by an older write falls back just like a null one.
        title: orBase(t?.title, row.title ?? '') || null,
        description: orBase(t?.description, row.description ?? '') || null,
        altText: orBase(t?.altText, row.altText ?? '') || null,
      };
    });
  }

  async getMyMedia(actor: MediaActor, query: MediaGalleryQueryDto) {
    const {
      page = 1,
      limit = 20,
      sortBy = 'uploadedAt',
      sortOrder = 'desc',
      type = 'all',
    } = query;
    const skip = (page - 1) * limit;

    // mimeType is the precise signal; rows uploaded before that column
    // existed (null) fall back to Cloudinary's resourceType. Audio lives
    // under resourceType 'video' on Cloudinary, so no legacy fallback there.
    const typeWhere: Prisma.MediaGalleryWhereInput = (() => {
      switch (type) {
        case 'image':
          return {
            OR: [
              {
                mimeType: { startsWith: 'image/' },
                NOT: { mimeType: 'image/svg+xml' },
              },
              { mimeType: null, resourceType: 'image' },
            ],
          };
        case 'video':
          return {
            OR: [
              { mimeType: { startsWith: 'video/' } },
              { mimeType: null, resourceType: 'video' },
            ],
          };
        case 'audio':
          return { mimeType: { startsWith: 'audio/' } };
        case 'svg':
          return { mimeType: 'image/svg+xml' };
        default:
          return {};
      }
    })();
    /**
     * "Still needs translating into <locale>" - the media library's answer to the
     * Translation Console, which cannot enumerate thousands of assets.
     *
     * Anchored on `altText` because that is the field with real public impact
     * (og:image, gallery photos, heroes). Gating the worklist on title or
     * description would manufacture busywork: nothing renders those yet.
     *
     * `altText: { not: null }` first - an asset with no English alt text has
     * nothing to translate, and listing it forever would make the filter useless.
     *
     * A row that EXISTS with a null altText and the human flag is a deliberate
     * clear ("show English here"), so it is excluded: nagging about it would
     * fight the clear-means-clear contract. Only a missing row, or a machine row
     * the AI left without alt text, counts as outstanding work.
     */
    // `en` is ignored rather than honoured: English lives on the asset row, so
    // NO asset ever has an `en` translation row and `none: { locale: 'en' }`
    // would match every one of them - a filter that looks like it did something
    // while quietly changing nothing about which rows are outstanding.
    const untranslatedLocale =
      query.untranslated && query.untranslated !== Locale.en
        ? query.untranslated
        : undefined;

    const untranslatedWhere: Prisma.MediaGalleryWhereInput = untranslatedLocale
      ? {
          altText: { not: null },
          OR: [
            { translations: { none: { locale: untranslatedLocale } } },
            {
              translations: {
                some: {
                  locale: untranslatedLocale,
                  altText: null,
                  isMachineTranslated: true,
                },
              },
            },
          ],
        }
      : {};

    // AND, never a spread. `mediaScope` returns `{ OR: [...] }` for an operator
    // context and both `typeWhere` and `untranslatedWhere` can carry their own
    // `OR` - spreading them into one object makes the last `OR` silently
    // overwrite the earlier ones. That is not a cosmetic difference: losing the
    // scope clause hands one operator every other operator's library.
    const where: Prisma.MediaGalleryWhereInput = {
      AND: [await this.mediaScope(actor), typeWhere, untranslatedWhere],
    };

    // Rows uploaded before the metadata columns existed have null
    // originalName/bytes - keep them at the end regardless of direction.
    const orderBy: Prisma.MediaGalleryOrderByWithRelationInput[] = (() => {
      switch (sortBy) {
        case 'name':
          return [{ originalName: { sort: sortOrder, nulls: 'last' } }];
        case 'size':
          return [{ bytes: { sort: sortOrder, nulls: 'last' } }];
        case 'type':
          return [{ mimeType: { sort: sortOrder, nulls: 'last' } }];
        default:
          return [{ uploadedAt: sortOrder }];
      }
    })();
    // Stable tiebreak so pagination never duplicates/skips rows
    orderBy.push({ id: 'asc' });

    const [total, data] = await Promise.all([
      this.prisma.mediaGallery.count({ where }),
      this.prisma.mediaGallery.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data };
  }

  async getMediaById(id: string, actor: MediaActor): Promise<MediaGallery> {
    const media = await this.prisma.mediaGallery.findFirst({
      where: { id, ...(await this.mediaScope(actor)) },
    });

    if (!media) {
      throw new NotFoundException(`Media ${id} not found`);
    }

    return media;
  }

  /**
   * Update editable attachment metadata (title, description, altText,
   * fileName, excludeFromIndexing). Ownership-scoped; empty strings clear
   * the field to null.
   */
  async updateMedia(
    id: string,
    actor: MediaActor,
    dto: UpdateMediaDto,
  ): Promise<MediaGallery> {
    const existing = await this.prisma.mediaGallery.findFirst({
      where: { id, ...(await this.mediaScope(actor)) },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException(`Media ${id} not found`);
    }

    const updated = await this.prisma.mediaGallery.update({
      where: { id },
      data: {
        title: clean(dto.title),
        description: clean(dto.description),
        altText: clean(dto.altText),
        fileName: clean(dto.fileName),
        excludeFromIndexing: dto.excludeFromIndexing,
      },
    });

    // English copy changed -> queue the AI to refresh the other six locales.
    // Only when copy actually changed: a filename tweak or an indexing toggle
    // has nothing to translate, and enqueuing on those would burn free-tier
    // quota re-hashing unchanged sources.
    //
    // Fire-and-forget by contract - it enqueues the asset's BUCKET, swallows
    // Redis failures, and never delays or fails this save.
    if (
      dto.title !== undefined ||
      dto.description !== undefined ||
      dto.altText !== undefined
    ) {
      this.contentTranslation.enqueueMedia(id);
    }

    return updated;
  }

  /**
   * Every stored locale for one asset, for the dashboard's inline locale
   * switcher. Takes NO locale param on purpose: the editor needs them all at
   * once, and a defaulted locale filter is exactly the trap that made the hub
   * page-sections editor silently show English only.
   *
   * English is absent from the result by construction - it lives on the base
   * `MediaGallery` row and is edited through `PATCH /media-gallery/:id`.
   */
  async getTranslations(id: string, actor: MediaActor) {
    await this.assertVisible(id, actor);

    return this.prisma.mediaTranslation.findMany({
      where: { mediaId: id },
      select: {
        locale: true,
        title: true,
        description: true,
        altText: true,
        isMachineTranslated: true,
        updatedAt: true,
      },
      orderBy: { locale: 'asc' },
    });
  }

  /**
   * Upsert one locale's copy for one asset - the dashboard's per-locale save.
   *
   * ## Clearing
   * An empty string stores NULL and the ROW SURVIVES. That is the whole
   * contract: the surviving row carries `isMachineTranslated: false`, which the
   * AI refresher reads as human-owned and skips, so a field the editor cleared
   * STAYS cleared and the public page falls back to English for it. Deleting the
   * row instead would read as "never translated" and get refilled on the next
   * English edit.
   *
   * Every write is a human write, so the machine flag and the source hash are
   * always reset - never taken from the DTO, which has no business carrying them.
   */
  async upsertTranslation(
    id: string,
    locale: Locale,
    actor: MediaActor,
    dto: UpsertMediaTranslationDto,
  ) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'English is the source every other locale falls back to - edit it on the asset itself via PATCH /media-gallery/:id.',
      );
    }
    await this.assertVisible(id, actor);

    const fields = {
      title: clean(dto.title) ?? null,
      description: clean(dto.description) ?? null,
      altText: clean(dto.altText) ?? null,
    };

    const row = await this.prisma.mediaTranslation.upsert({
      where: { mediaId_locale: { mediaId: id, locale } },
      create: {
        mediaId: id,
        locale,
        ...fields,
        isMachineTranslated: false,
        sourceHash: null,
      },
      update: { ...fields, isMachineTranslated: false, sourceHash: null },
      select: {
        locale: true,
        title: true,
        description: true,
        altText: true,
        isMachineTranslated: true,
        updatedAt: true,
      },
    });
    this.logger.log(`Media ${id} ${locale} copy saved by ${actor.id}`);
    return row;
  }

  /**
   * Translate ONE asset into one locale on demand (the viewer's AI button).
   *
   * Goes through the registry's single-uuid branch, so it costs one provider call
   * and touches only this asset - unlike the background path, which deliberately
   * batches a whole bucket. Ownership is checked first: an operator must not be
   * able to spend quota on, or rewrite, another operator's library.
   *
   * The overwrite policy is the pipeline's, unchanged: a human-saved row is left
   * alone unless `force`, so this button cannot quietly undo someone's edit.
   */
  async generateTranslation(
    id: string,
    locale: Locale,
    actor: MediaActor,
    force = false,
  ) {
    if (locale === Locale.en) {
      throw new BadRequestException(
        'English is the source language - pick a target locale',
      );
    }
    await this.assertVisible(id, actor);

    // The only AI-translate route without a try/catch used to be this one: a
    // provider failure (bad key, rate limit, timeout) fell through the global
    // filter as a bare 500 "Internal server error". Same mapping as the
    // Translation Console routes.
    try {
      return await this.contentTranslationService.translateEntity(
        'media',
        id,
        [locale],
        force,
      );
    } catch (err) {
      throw toTranslationHttpError(err);
    }
  }

  /** 404s unless the asset is inside the actor's media scope. */
  private async assertVisible(id: string, actor: MediaActor): Promise<void> {
    const found = await this.prisma.mediaGallery.findFirst({
      where: { id, ...(await this.mediaScope(actor)) },
      select: { id: true },
    });
    if (!found) {
      throw new NotFoundException(`Media ${id} not found`);
    }
  }

  async deleteMedia(
    id: string,
    actor: MediaActor,
  ): Promise<{ message: string }> {
    const media = await this.getMediaById(id, actor);
    if (!media) {
      throw new NotFoundException(`Media ${id} not found`);
    }

    // Delete from Cloudinary (best-effort - if it fails, still remove DB record)
    await this.cloudinaryService.deleteFile(media.publicId);

    await this.prisma.mediaGallery.delete({ where: { id } });
    this.logger.log(`Deleted media ${id} for user ${actor.id}`);
    return { message: 'Media deleted successfully' };
  }

  async deleteMediaByPublicId(
    publicId: string,
    actor: MediaActor,
  ): Promise<{ message: string }> {
    const media = await this.prisma.mediaGallery.findFirst({
      where: { publicId, ...(await this.mediaScope(actor)) },
    });

    if (!media) {
      throw new NotFoundException(`Media with publicId ${publicId} not found`);
    }

    // Delete from Cloudinary
    await this.cloudinaryService.deleteFile(media.publicId);

    // Delete from DB
    await this.prisma.mediaGallery.delete({ where: { id: media.id } });

    this.logger.log(
      `Deleted media with publicId ${publicId} for user ${actor.id}`,
    );

    return { message: 'Media deleted successfully' };
  }

  // ─── Bulk delete ─────────────────────────────────────────────────────────────

  /**
   * Bulk delete: removes each record from Cloudinary and then batch-deletes
   * all DB rows in a single Prisma call.  Per-file Cloudinary failures are
   * logged but do NOT abort the batch - we always remove the DB record so the
   * UI stays consistent.
   */
  async bulkDeleteMedia(
    ids: string[],
    actor: MediaActor,
  ): Promise<{ deleted: number; failed: number }> {
    // 1. Fetch all matching records inside the actor's scope (prevents IDOR)
    const scope = await this.mediaScope(actor);
    const records = await this.prisma.mediaGallery.findMany({
      where: { id: { in: ids }, ...scope },
    });

    let deleted = 0;
    let failed = 0;

    // 2. Delete each Cloudinary asset (best-effort, parallel)
    await Promise.allSettled(
      records.map(async (record) => {
        try {
          await this.cloudinaryService.deleteFile(record.publicId);
        } catch (err) {
          this.logger.warn(
            `Cloudinary delete failed for publicId ${record.publicId}: ${(err as Error).message}`,
          );
        }
      }),
    );

    // 3. Batch-delete from DB in one query
    const result = await this.prisma.mediaGallery.deleteMany({
      where: { id: { in: records.map((r) => r.id) }, ...scope },
    });

    deleted = result.count;
    failed = ids.length - deleted;

    this.logger.log(
      `Bulk delete: ${deleted} deleted, ${failed} failed for user ${actor.id}`,
    );

    return { deleted, failed };
  }
}
