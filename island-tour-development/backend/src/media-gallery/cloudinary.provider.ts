import { Provider } from '@nestjs/common';
import { v2 as cloudinary } from 'cloudinary';

/**
 * CloudinaryProvider — configures the Cloudinary SDK singleton at NestJS
 * bootstrap time using environment variables.
 *
 * Registered as a plain value provider so other services can inject
 * the already-configured `cloudinary` instance if needed, while
 * CloudinaryService uses it directly via the module-level import.
 *
 * Env vars expected:
 *   CLOUDINARY_CLOUD_NAME
 *   CLOUDINARY_API_KEY
 *   CLOUDINARY_API_SECRET
 */
export const CLOUDINARY = 'CLOUDINARY';

export const CloudinaryProvider: Provider = {
  provide: CLOUDINARY,
  useFactory: () => {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
      secure: true,
    });
    return cloudinary;
  },
};
