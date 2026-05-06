import { PrismaService } from '@/prisma/prisma.service';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { MediaGallery } from '@prisma/client';
import { CloudinaryService } from './cloudinary.service';
import type { Multer } from 'multer';

import type {
  ConfirmUploadDto,
  MediaGalleryQueryDto,
} from './dto/upload-media.dto';

/**
 * MediaGalleryService — all database and Cloudinary orchestration logic.
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
 * (partial success is acceptable — return only what was saved).
 */
@Injectable()
export class MediaGalleryService {
  private readonly logger = new Logger(MediaGalleryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  // ─── Server-side upload ──────────────────────────────────────────────────────

  /**
   * Upload an array of Multer files one-by-one.
   * On DB failure after a successful Cloudinary upload, the cloud asset is
   * rolled back before re-throwing.  Files already committed remain saved.
   */
  async uploadFiles(
    files: Express.Multer.File[],
    userId: string,
  ): Promise<MediaGallery[]> {
    const saved: MediaGallery[] = [];

    for (const file of files) {
      let cloudResult: {
        publicId: string;
        url: string;
        resourceType: string;
      } | null = null;

      try {
        // 1. Upload to Cloudinary
        cloudResult = await this.cloudinaryService.uploadFile(file, userId);

        // 2. Persist to DB
        const record = await this.prisma.mediaGallery.create({
          data: {
            url: cloudResult.url,
            publicId: cloudResult.publicId,
            resourceType: cloudResult.resourceType,
            userId,
          },
        });

        saved.push(record);
        this.logger.log(
          `Uploaded and saved media ${record.id} for user ${userId}`,
        );
      } catch (err) {
        // If Cloudinary succeeded but DB failed → rollback the cloud asset
        if (cloudResult) {
          this.logger.warn(
            `DB write failed for ${cloudResult.publicId}, rolling back Cloudinary upload`,
          );
          await this.cloudinaryService.deleteFile(cloudResult.publicId);
        }
        this.logger.error(
          `Upload failed for file ${file.originalname}: ${(err as Error).message}`,
        );
        throw err;
      }
    }

    return saved;
  }

  // ─── Signed upload flow (direct client → Cloudinary) ────────────────────────

  /**
   * Generate HMAC-signed parameters the client sends directly to Cloudinary.
   * No file bytes reach the NestJS server.
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
    userId: string,
  ): Promise<MediaGallery> {
    // Verify the asset actually exists on Cloudinary (prevents spoofed publicIds)
    try {
      await this.cloudinaryService.verifyAssetExists(dto.publicId);
    } catch {
      throw new NotFoundException(
        `Cloudinary asset not found for publicId: ${dto.publicId}`,
      );
    }

    const record = await this.prisma.mediaGallery.create({
      data: {
        url: dto.url,
        publicId: dto.publicId,
        resourceType: dto.resourceType,
        userId,
      },
    });

    this.logger.log(`Confirmed direct upload ${record.id} for user ${userId}`);

    return record;
  }

  // ─── Queries ─────────────────────────────────────────────────────────────────

  async getMyMedia(userId: string, query: MediaGalleryQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [total, data] = await Promise.all([
      this.prisma.mediaGallery.count({ where: { userId } }),
      this.prisma.mediaGallery.findMany({
        where: { userId },
        orderBy: { uploadedAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data };
  }

  async getMediaById(id: string, userId: string): Promise<MediaGallery> {
    const media = await this.prisma.mediaGallery.findFirst({
      where: { id, userId },
    });

    if (!media) {
      throw new NotFoundException(`Media ${id} not found`);
    }

    return media;
  }

  async deleteMedia(id: string, userId: string): Promise<{ message: string }> {
    const media = await this.getMediaById(id, userId);
    if (!media) {
      throw new NotFoundException(`Media ${id} not found`);
    }

    // Delete from Cloudinary (best-effort — if it fails, still remove DB record)
    await this.cloudinaryService.deleteFile(media.publicId);

    await this.prisma.mediaGallery.delete({ where: { id } });
    this.logger.log(`Deleted media ${id} for user ${userId}`);
    return { message: 'Media deleted successfully' };
  }

  async deleteMediaByPublicId(publicId: string, userId: string): Promise<{ message: string }> {
    const media = await this.prisma.mediaGallery.findFirst({
      where: { publicId, userId },
    });

    if (!media) {
      throw new NotFoundException(`Media with publicId ${publicId} not found`);
    }

    // Delete from Cloudinary
    await this.cloudinaryService.deleteFile(media.publicId);

    // Delete from DB
    await this.prisma.mediaGallery.delete({ where: { id: media.id } });

    this.logger.log(`Deleted media with publicId ${publicId} for user ${userId}`);

    return { message: 'Media deleted successfully' };
  }
}
