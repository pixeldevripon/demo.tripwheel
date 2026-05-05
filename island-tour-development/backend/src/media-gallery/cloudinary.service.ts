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
 * CloudinaryService — thin wrapper around the Cloudinary v2 SDK.
 *
 * Configured by CloudinaryProvider (cloudinary.provider.ts) which calls
 * cloudinary.config() at bootstrap time — no constructor config needed here.
 *
 * Responsibilities:
 *  - uploadFile(file, userId)          → server-side upload to users/<userId>
 *  - deleteFile(publicId)              → destroy by public_id (all resource types)
 *  - generateSignedUploadParams(userId) → signed params for direct client uploads
 */
@Injectable()
export class CloudinaryService {
  private readonly logger = new Logger(CloudinaryService.name);

  /**
   * Upload a single Multer file to Cloudinary under the users/<userId> folder.
   * resource_type is 'auto' — Cloudinary infers image / video / raw.
   */
  async uploadFile(
    file: Express.Multer.File,
    userId: string,
  ): Promise<CloudinaryUploadResult> {
    const folder = `users/${userId}`;

    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder, resource_type: 'auto' },
        (error, result) => {
          if (error) {
            return reject(
              new Error(
                `Cloudinary upload failed: ${error.message ?? JSON.stringify(error)}`,
              ),
            );
          }
          if (!result) {
            return reject(new Error('Cloudinary upload returned no result'));
          }
          resolve({
            publicId: result.public_id,
            url: result.secure_url,
            resourceType: result.resource_type,
          });
        },
      );

      Readable.from(file.buffer).pipe(uploadStream);
    });
  }

  /**
   * Delete a Cloudinary asset by its public_id.
   * Uses resource_type 'image' by default — for video use deleteFileByType.
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
    const folder = `users/${userId}`;
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
    };
  }
}
