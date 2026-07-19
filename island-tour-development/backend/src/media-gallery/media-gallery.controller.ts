import type { TypedAuthUser } from '@/auth/auth.types';
import { AuthenticatedUser } from '@/auth/decorators/authenticated-user.decorator';
import { Public } from '@/auth/decorators/public.decorator';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Multer } from 'multer';

import { ApiTags } from '@nestjs/swagger';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import {
  BulkDeleteMediaDto,
  ConfirmUploadDto,
  MediaGalleryQueryDto,
  UpdateMediaDto,
} from './dto/upload-media.dto';
import { MediaGalleryService } from './media-gallery.service';
import type { MediaUploadJobPayload } from './media-upload.processor';
import {
  ApiConfirmUploadDocs,
  ApiDeleteMediaDocs,
  ApiGetMediaByIdDocs,
  ApiGetMyMediaDocs,
  ApiGetExcludedUrlsDocs,
  ApiGetSignedParamsDocs,
  ApiUpdateMediaDocs,
  ApiUploadMediaAsyncDocs,
  ApiUploadMediaDocs,
} from './media-gallery.swagger';

/**
 * Allowed MIME types for upload - every media type a web page can use.
 * Grouped: raster images, vector/icon, video, audio.
 */
const ALLOWED_MIMETYPES = new Set([
  // Images (raster)
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/heif',
  // Images (vector / icon)
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  // Video
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-m4v',
  'video/x-matroska',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/flac',
  'audio/x-flac',
  'audio/opus',
]);

// Cloudinary's own per-plan limits still apply on top of this (e.g. 10 MB
// images / 100 MB video on the free plan) - those surface as upload errors.
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

/** Shared Multer fileFilter for both upload routes. */
const mediaFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!ALLOWED_MIMETYPES.has(file.mimetype)) {
    return callback(
      new BadRequestException(
        `File type not allowed: ${file.mimetype}. Allowed: web image, video and audio formats (jpeg, png, webp, gif, avif, svg, ico, mp4, webm, mov, mp3, wav, ogg, aac, m4a, flac, ...)`,
      ),
      false,
    );
  }
  callback(null, true);
};

@ApiTags('Media Gallery')
@Controller('media-gallery')
/**
 * MediaGalleryController - manages media uploads and gallery for authenticated users.
 *
 * ## Upload strategies
 *  1. POST /upload         - server-side synchronous upload (files pass through NestJS)
 *  2. POST /upload/async   - server-side background upload via BullMQ + Upstash Redis
 *  3. GET  /sign           - get signed params for direct client → Cloudinary upload
 *  4. POST /confirm        - register a completed direct upload in the DB
 *
 * ## Access-control
 * All routes require an active Better Auth session (enforced by the global
 * AuthGuard in AuthModule). userId is always sourced from the validated session -
 * no IDOR risk from URL params.
 *
 * ## Route-ordering rule (NestJS)
 * Static paths ('upload', 'upload/async', 'sign', 'confirm') are declared
 * before the dynamic ':id' segment to prevent NestJS matching them as IDs.
 */
export class MediaGalleryController {
  constructor(
    private readonly mediaGalleryService: MediaGalleryService,
    @InjectQueue('media-upload') private readonly mediaUploadQueue: Queue,
  ) {}

  // ─── Server-side synchronous upload ──────────────────────────────────────────

  /**
   * POST /media-gallery/upload
   *
   * Upload up to 10 files synchronously through the NestJS server.
   * Files are validated for MIME type and size before reaching the service.
   * Each file is uploaded to Cloudinary and persisted to the DB sequentially
   * with per-file rollback on DB failure.
   */
  @Post('upload')
  @ApiUploadMediaDocs()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: mediaFileFilter,
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }
    return this.mediaGalleryService.uploadFiles(files, user.id);
  }

  // ─── Background async upload via BullMQ + Upstash Redis ─────────────────────

  /**
   * POST /media-gallery/upload/async
   *
   * Accepts files and immediately enqueues a BullMQ job per file.
   * Returns job IDs - the client can poll or use WebSockets for completion.
   * The file buffer is base64-encoded for JSON-serialisable job payloads.
   */
  @Post('upload/async')
  @ApiUploadMediaAsyncDocs()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_FILE_SIZE },
      fileFilter: mediaFileFilter,
    }),
  )
  async uploadAsync(
    @UploadedFiles() files: Express.Multer.File[],
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('At least one file is required');
    }

    const jobIds: string[] = [];

    for (const file of files) {
      const payload: MediaUploadJobPayload = {
        buffer: file.buffer.toString('base64'),
        mimetype: file.mimetype,
        originalname: file.originalname,
        userId: user.id,
      };

      const job = await this.mediaUploadQueue.add('upload', payload, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 100 },
      });

      jobIds.push(job.id as string);
    }

    return { message: 'Upload queued', jobIds };
  }

  // ─── Signed upload flow ───────────────────────────────────────────────────────

  /**
   * GET /media-gallery/sign
   *
   * Returns HMAC-signed parameters the client sends directly to Cloudinary.
   * No file bytes pass through the NestJS server.
   * After upload completes, the client calls POST /confirm.
   */
  @Get('sign')
  @ApiGetSignedParamsDocs()
  getSignedParams(@AuthenticatedUser() user: TypedAuthUser) {
    return this.mediaGalleryService.getSignedUploadParams(user.id);
  }

  /**
   * POST /media-gallery/confirm
   *
   * Validates the publicId exists in Cloudinary (prevents spoofing),
   * then saves the media record to the DB.
   */
  @Post('confirm')
  @ApiConfirmUploadDocs()
  confirmUpload(
    @Body() dto: ConfirmUploadDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.mediaGalleryService.confirmUpload(dto, user.id);
  }

  // ─── Queries ──────────────────────────────────────────────────────────────────

  /**
   * GET /media-gallery
   *
   * Paginated list of the authenticated user's uploaded media.
   */
  @Get()
  @ApiGetMyMediaDocs()
  getMyMedia(
    @AuthenticatedUser() user: TypedAuthUser,
    @Query() query: MediaGalleryQueryDto,
  ) {
    return this.mediaGalleryService.getMyMedia(user.id, query);
  }

  /**
   * GET /media-gallery/excluded-urls
   *
   * Public, platform-wide list of media URLs flagged "exclude from indexing".
   * The public site's SEO layer filters og:image / structured data / image
   * sitemaps against this list. Static route - MUST stay above ':id'.
   */
  @Public()
  @Get('excluded-urls')
  @ApiGetExcludedUrlsDocs()
  getExcludedUrls() {
    return this.mediaGalleryService.getExcludedUrls();
  }

  /**
   * GET /media-gallery/:id
   *
   * Fetch a single media record owned by the authenticated user.
   * Returns 404 if the record does not belong to the caller.
   */
  @Get(':id')
  @ApiGetMediaByIdDocs()
  getMediaById(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.mediaGalleryService.getMediaById(id, user.id);
  }

  // ─── Mutations ────────────────────────────────────────────────────────────────

  /**
   * PATCH /media-gallery/:id
   *
   * Updates editable attachment metadata (title, description, altText,
   * fileName, excludeFromIndexing). Returns 404 if the record doesn't
   * belong to the caller.
   */
  @Patch(':id')
  @ApiUpdateMediaDocs()
  updateMedia(
    @Param('id') id: string,
    @Body() dto: UpdateMediaDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.mediaGalleryService.updateMedia(id, user.id, dto);
  }

  /**
   * DELETE /media-gallery/bulk
   *
   * Bulk-deletes multiple media records owned by the authenticated user.
   * Cloudinary deletions run in parallel; a single Cloudinary failure does NOT
   * abort the batch - all matched DB rows are always removed.
   * Returns { deleted, failed } counts.
   *
   * NOTE: This static route MUST come before the dynamic ':id' route so that
   * NestJS does not interpret 'bulk' as a media ID.
   */
  @Delete('bulk')
  bulkDeleteMedia(
    @Body() dto: BulkDeleteMediaDto,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.mediaGalleryService.bulkDeleteMedia(dto.ids, user.id);
  }

  /**
   * DELETE /media-gallery/:id
   *
   * Deletes the media record from the DB and removes the asset from Cloudinary.
   * Returns 404 if the record doesn't exist or doesn't belong to the caller.
   */
  @Delete(':id')
  @ApiDeleteMediaDocs()
  deleteMedia(
    @Param('id') id: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.mediaGalleryService.deleteMedia(id, user.id);
  }

  /**
   * DELETE /media-gallery/public/:publicId
   *
   * Deletes the media record from the DB and removes the asset from Cloudinary
   * using the publicId.
   */
  @Delete('public/:publicId')
  @ApiDeleteMediaDocs() // We can reuse the docs decorator or create a new one
  deleteMediaByPublicId(
    @Param('publicId') publicId: string,
    @AuthenticatedUser() user: TypedAuthUser,
  ) {
    return this.mediaGalleryService.deleteMediaByPublicId(publicId, user.id);
  }
}
