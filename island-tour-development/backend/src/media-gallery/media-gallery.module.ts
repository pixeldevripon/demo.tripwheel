import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CloudinaryProvider } from './cloudinary.provider';
import { CloudinaryService } from './cloudinary.service';
import { MediaGalleryController } from './media-gallery.controller';
import { MediaGalleryService } from './media-gallery.service';
import { MediaUploadProcessor } from './media-upload.processor';

/**
 * Build BullMQ Redis connection options.
 *
 * ## Upstash Redis (recommended for production)
 * Upstash provides a `rediss://` URL (note the double 's' — TLS).
 * Set UPSTASH_REDIS_URL in your .env:
 *   UPSTASH_REDIS_URL=rediss://default:<token>@<host>.upstash.io:6379
 *
 * When UPSTASH_REDIS_URL is present we parse host/port/password from it
 * and enable `tls: {}` (required by Upstash).
 *
 * ## Local Redis (development fallback)
 * Without UPSTASH_REDIS_URL, falls back to:
 *   REDIS_HOST=localhost  REDIS_PORT=6379  (no TLS)
 */
function buildRedisConnection() {
  const upstashUrl = process.env.UPSTASH_REDIS_URL;

  if (upstashUrl) {
    // Parse  rediss://default:<password>@<host>:<port>
    const url = new URL(upstashUrl);
    return {
      host: url.hostname,
      port: Number(url.port) || 6379,
      password: url.password || undefined,
      // Upstash requires TLS — the protocol is rediss://
      tls: url.protocol === 'rediss:' ? {} : undefined,
      // Upstash REST connections time out quickly; keep-alive helps BullMQ
      enableOfflineQueue: false,
    };
  }

  // Local / self-hosted Redis
  return {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
  };
}

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
