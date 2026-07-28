import { PrismaService } from '@/prisma/prisma.service';
import { StaffPermissionsService } from '@/staff/staff-permissions.service';
import { resolveOperatorId } from '@/common/utils/operator.util';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Permission, Role } from '@prisma/client';
import type { MediaGallery, Prisma } from '@prisma/client';
import { CloudinaryService } from './cloudinary.service';
import type { Multer } from 'multer';

import type {
  ConfirmUploadDto,
  MediaGalleryQueryDto,
  UpdateMediaDto,
} from './dto/upload-media.dto';

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
    const where: Prisma.MediaGalleryWhereInput = {
      ...(await this.mediaScope(actor)),
      ...typeWhere,
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

    const clean = (v: string | undefined) =>
      v === undefined ? undefined : v.trim() === '' ? null : v.trim();

    return this.prisma.mediaGallery.update({
      where: { id },
      data: {
        title: clean(dto.title),
        description: clean(dto.description),
        altText: clean(dto.altText),
        fileName: clean(dto.fileName),
        excludeFromIndexing: dto.excludeFromIndexing,
      },
    });
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
