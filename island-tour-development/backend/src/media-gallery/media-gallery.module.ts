import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { buildRedisConnection } from '@/common/utils/redis.util';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';
import { MediaGalleryController } from './media-gallery.controller';
import { MediaGalleryService } from './media-gallery.service';
import { MediaUploadProcessor } from './media-upload.processor';

@Module({
  imports: [
    /**
     * Register the 'media-upload' BullMQ queue.
     * PrismaModule is @Global() so PrismaService is already injectable here.
     * Redis connection auto-detects Upstash vs. local Redis (see above).
     */
    BullModule.registerQueue({
      name: 'media-upload',
      connection: buildRedisConnection(),
    }),
  ],
  controllers: [MediaGalleryController],
  providers: [
    // Configures the Cloudinary SDK singleton at bootstrap time
    CloudinaryProvider,
    CloudinaryService,
    MediaGalleryService,
    // BullMQ worker — processes jobs from the 'media-upload' queue
    MediaUploadProcessor,
  ],
  exports: [CloudinaryService],
})
export class MediaGalleryModule {}
