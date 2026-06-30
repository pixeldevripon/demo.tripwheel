import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '@/prisma/prisma.service';
import { CloudinaryService } from './cloudinary.service';
import type { Multer } from 'multer';

export interface MediaUploadJobPayload {
  /** base64-encoded file buffer (BullMQ serializes jobs to JSON) */
  buffer: string;
  mimetype: string;
  originalname: string;
  userId: string;
}

/**
 * MediaUploadProcessor - consumes jobs from the 'media-upload' BullMQ queue.
 *
 * Each job:
 *  1. Decodes the base64 buffer back to a Buffer
 *  2. Builds a minimal Express.Multer.File-like object
 *  3. Uploads to Cloudinary under users/<userId>
 *  4. Persists the record in media_gallery
 *  5. On DB failure → rolls back the Cloudinary upload (best-effort)
 */
@Processor('media-upload')
export class MediaUploadProcessor extends WorkerHost {
  private readonly logger = new Logger(MediaUploadProcessor.name);

  constructor(
    private readonly cloudinaryService: CloudinaryService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job<MediaUploadJobPayload>): Promise<void> {
    const { buffer: base64Buffer, mimetype, originalname, userId } = job.data;

    this.logger.log(
      `Processing job ${job.id} - file: ${originalname}, user: ${userId}`,
    );

    // Decode base64 → Buffer
    const fileBuffer = Buffer.from(base64Buffer, 'base64');

    // Reconstruct a minimal Multer.File-like object
    const file = {
      buffer: fileBuffer,
      mimetype,
      originalname,
      size: fileBuffer.length,
    } as Express.Multer.File;

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

      this.logger.log(
        `Job ${job.id} completed - saved media ${record.id} for user ${userId}`,
      );
    } catch (err) {
      // If Cloudinary succeeded but DB write failed → rollback cloud asset
      if (cloudResult) {
        this.logger.warn(
          `Job ${job.id}: DB write failed for ${cloudResult.publicId}, rolling back Cloudinary upload`,
        );
        await this.cloudinaryService.deleteFile(cloudResult.publicId);
      }

      this.logger.error(
        `Job ${job.id} failed for file ${originalname}: ${(err as Error).message}`,
      );

      // Re-throw so BullMQ marks the job as failed and can retry
      throw err;
    }
  }
}
