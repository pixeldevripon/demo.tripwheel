import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import type { Multer } from 'multer';

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  resourceType: string;
}

/**
 * Root folder for every Cloudinary asset this platform owns, so the account
 * stays partitioned if it is ever shared with another property.
 * Assets uploaded before this prefix existed still resolve by their stored
 * public_id - this only governs where NEW uploads land.
 */
export const CLOUDINARY_ROOT_FOLDER = 'islandtours';

/**
 * Size-aware delivery policy (images only):
 *  - above COMPRESS_ABOVE_BYTES  → q_auto/f_auto compression
 *  - below UPSCALE_BELOW_BYTES   → 2x scale-up (no quality reduction)
 *  - in between                  → original served untouched
 */
export const COMPRESS_ABOVE_BYTES = 5 * 1024 * 1024; // 5 MB
export const UPSCALE_BELOW_BYTES = 1 * 1024 * 1024; // 1 MB

/**
 * CloudinaryService - thin wrapper around the Cloudinary v2 SDK.
 *
 * Configured by CloudinaryProvider (cloudinary.provider.ts) which calls
 * cloudinary.config() at bootstrap time - no constructor config needed here.
 *
 * Responsibilities:
 *  - uploadFile(file, userId)          → server-side upload to islandtours/users/<userId>
 *  - deleteFile(publicId)              → destroy by public_id (all resource types)
 *  - generateSignedUploadParams(userId) → signed params for direct client uploads
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  /**
   * Folder a given user's uploads land in. Both the server-side upload and the
   * signed direct-upload params must derive the folder here: the signature
   * covers `folder`, so any drift between the two would fail verification.
   */
  private userFolder(userId: string): string {
    return `${CLOUDINARY_ROOT_FOLDER}/users/${userId}`;
  }

  /**
   * Upload a single Multer file to Cloudinary under islandtours/users/<userId>.
   * resource_type is 'auto' - Cloudinary infers image / video / raw.
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<CloudinaryUploadResult> {
    const folder = this.userFolder(userId);

    // Convert buffer to base64 data URI - eliminates stream overhead
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: 'auto',
    });

    return {
      publicId: result.public_id,
      url: this.getOptimizedUrl(
        result.public_id,
        result.resource_type,
        result.bytes,
      ),
      resourceType: result.resource_type,
    };
  }

  /**
   * Generate the delivery URL for an asset, applying transformations based on
   * the stored file size (images only - videos always get f_auto/q_auto):
   *  - > 5 MB       → f_auto + q_auto so Cloudinary compresses it
   *  - < 1 MB       → 2x upscale (c_scale,w_2.0) with f_auto, quality untouched
   *  - 1-5 MB       → plain secure URL, no transformation at all
   * When bytes is unknown the original is served untouched.
   */
  getOptimizedUrl(
    publicId: string,
    resourceType: string = 'image',
    bytes?: number,
  ): string {
    if (resourceType !== 'image') {
      return cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
        fetch_format: 'auto',
        quality: 'auto',
      });
    }

    if (typeof bytes === 'number' && bytes > COMPRESS_ABOVE_BYTES) {
      return cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
        fetch_format: 'auto',
        quality: 'auto',
      });
    }

    if (typeof bytes === 'number' && bytes < UPSCALE_BELOW_BYTES) {
      // 4x upscale, then cap at 4096px so the output can never exceed
      // Cloudinary's megapixel processing limit (c_limit only shrinks).
      return cloudinary.url(publicId, {
        resource_type: resourceType,
        secure: true,
        transformation: [
          { crop: 'scale', width: '4.0' },
          { crop: 'limit', width: 4096, height: 4096 },
          { fetch_format: 'auto' },
        ],
      });
    }

    return cloudinary.url(publicId, {
      resource_type: resourceType,
      secure: true,
    });
  }

  /**
   * Delete a Cloudinary asset by its public_id.
   * Uses resource_type 'image' by default - for video use deleteFileByType.
   * Silently logs on failure rather than throwing, so callers can treat
   * Cloudinary cleanup as best-effort.
   */
  async deleteFile(publicId: string): Promise<void> {
    try {
      // Try image first; if it fails Cloudinary returns { result: 'not found' }
      const res = await cloudinary.uploader.destroy(publicId, {
        resource_type: 'image',
        invalidate: true,
      });

      // If not found as image, retry as video
      if (res.result === 'not found') {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: 'video',
          invalidate: true,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to delete Cloudinary asset ${publicId}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Generate signed upload parameters so the client can upload directly to
   * Cloudinary without routing the file through the NestJS server.
   *
   * The client POSTs these params (including the file) to Cloudinary's upload
   * endpoint, then calls POST /media-gallery/confirm with the result.
   */
  generateSignedUploadParams(userId: string): {
    signature: string;
    timestamp: number;
    apiKey: string;
    cloudName: string;
    folder: string;
  } {
    const folder = this.userFolder(userId);
    const timestamp = Math.round(Date.now() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { folder, timestamp },
      process.env.CLOUDINARY_API_SECRET ?? '',
    );

    return {
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY ?? '',
      cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
      folder,
    };
  }

  /**
   * Verify a Cloudinary asset exists by calling the admin API.
   * Throws if the publicId is not found on the account.
   */
  async verifyAssetExists(publicId: string): Promise<{
    resource_type: string;
    secure_url: string;
    bytes: number;
  }> {
    // Cloudinary throws if the resource is not found
    const resource = await cloudinary.api
      .resource(publicId, {
        resource_type: 'image',
      })
      .catch(() =>
        cloudinary.api.resource(publicId, { resource_type: 'video' }),
      );

    return {
      resource_type: resource.resource_type,
      secure_url: resource.secure_url,
      bytes: resource.bytes,
    };
  }
}
