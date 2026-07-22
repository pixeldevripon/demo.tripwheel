import { Injectable, Logger } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

export interface CloudinaryUploadResult {
  publicId: string;
  url: string;
  resourceType: string;
  bytes?: number;
  format?: string;
  width?: number;
  height?: number;
}

/** Optional asset facts that drive the delivery-URL decision. */
export interface CloudinaryAssetMeta {
  bytes?: number;
  width?: number;
  format?: string;
}

/**
 * Root folder for every Cloudinary asset this platform owns, so the account
 * stays partitioned if it is ever shared with another property.
 * Assets uploaded before this prefix existed still resolve by their stored
 * public_id - this only governs where NEW uploads land.
 */
export const CLOUDINARY_ROOT_FOLDER = 'islandtours';

/**
 * Size-aware delivery policy (raster images only):
 *  - above COMPRESS_ABOVE_BYTES  → q_auto/f_auto compression
 *  - below UPSCALE_BELOW_BYTES AND source width ≤ UPSCALE_MAX_SOURCE_WIDTH
 *    → 2x scale-up (no quality reduction)
 *  - everything else             → original served untouched
 *
 * The width gate matters: a byte-small but pixel-large image (e.g. a well
 * compressed 4000px photo) must NOT be upscaled - rendering the huge
 * intermediate is so slow that downstream image optimizers time out.
 * With the gate, 2x output is naturally capped at 4096px.
 */
export const COMPRESS_ABOVE_BYTES = 5 * 1024 * 1024; // 5 MB
export const UPSCALE_BELOW_BYTES = 1 * 1024 * 1024; // 1 MB
export const UPSCALE_MAX_SOURCE_WIDTH = 2048;

/** Audio containers - Cloudinary stores audio under resource_type 'video'. */
const AUDIO_FORMATS = new Set([
  'mp3',
  'wav',
  'ogg',
  'aac',
  'm4a',
  'flac',
  'opus',
  'weba',
  'aiff',
  'amr',
]);

/** Vector / icon formats - never resized or recompressed. */
const VECTOR_FORMATS = new Set(['svg', 'ico']);

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
    /**
     * Folder RELATIVE to the platform root, overriding the per-user default.
     * Review photos (BE-16) are uploaded by a guest who may have no account of
     * their own, so they group by review rather than by user - and grouping by
     * review is what lets a later moderation deletion find the assets.
     */
    subFolder?: string,
  ): Promise<CloudinaryUploadResult> {
    const folder = subFolder
      ? `${CLOUDINARY_ROOT_FOLDER}/${subFolder}`
      : this.userFolder(userId);

    // Convert buffer to base64 data URI - eliminates stream overhead
    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder,
      resource_type: 'auto',
    });

    return {
      publicId: result.public_id,
      url: this.getOptimizedUrl(result.public_id, result.resource_type, {
        bytes: result.bytes,
        width: result.width,
        format: result.format,
      }),
      resourceType: result.resource_type,
      bytes: result.bytes,
      format: result.format,
      width: result.width,
      height: result.height,
    };
  }

  /**
   * Generate the delivery URL for an asset.
   *
   * Raster images (size policy - see constants above):
   *  - svg/ico              → plain URL (transforming a vector rasterizes it)
   *  - > 5 MB               → f_auto + q_auto so Cloudinary compresses it
   *  - < 1 MB and ≤ 2048px  → 2x upscale (c_scale,w_2.0), quality untouched
   *  - everything else      → plain secure URL, no transformation
   *
   * resource_type 'video':
   *  - audio formats        → plain URL (no visual transformations apply)
   *  - real video           → f_auto + q_auto
   *
   * Anything else (raw) is served plain. Unknown meta → plain.
   */
  getOptimizedUrl(
    publicId: string,
    resourceType: string = 'image',
    meta: CloudinaryAssetMeta = {},
  ): string {
    const { bytes, width, format } = meta;
    const plain = { resource_type: resourceType, secure: true };
    const compressed = {
      ...plain,
      fetch_format: 'auto',
      quality: 'auto',
    };

    if (resourceType === 'video') {
      const isAudio = format !== undefined && AUDIO_FORMATS.has(format);
      return cloudinary.url(publicId, isAudio ? plain : compressed);
    }

    if (resourceType !== 'image') {
      return cloudinary.url(publicId, plain);
    }

    if (format !== undefined && VECTOR_FORMATS.has(format)) {
      return cloudinary.url(publicId, plain);
    }

    if (typeof bytes === 'number' && bytes > COMPRESS_ABOVE_BYTES) {
      return cloudinary.url(publicId, compressed);
    }

    if (
      typeof bytes === 'number' &&
      bytes < UPSCALE_BELOW_BYTES &&
      typeof width === 'number' &&
      width > 0 &&
      width <= UPSCALE_MAX_SOURCE_WIDTH
    ) {
      return cloudinary.url(publicId, {
        ...plain,
        transformation: [
          { crop: 'scale', width: '2.0' },
          { fetch_format: 'auto' },
        ],
      });
    }

    return cloudinary.url(publicId, plain);
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
    width?: number;
    height?: number;
    format?: string;
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
      width: resource.width,
      height: resource.height,
      format: resource.format,
    };
  }
}
