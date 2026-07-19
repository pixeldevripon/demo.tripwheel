import {
  BadRequestErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import {
  AsyncUploadResponseDto,
  DeleteMediaResponseDto,
  MediaGalleryResponseDto,
  PaginatedMediaGalleryResponseDto,
  SignedUploadParamsResponseDto,
} from './dto/upload-media.dto';

// ── Shared error sets ─────────────────────────────────────────────────────────

const commonErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request - invalid input or disallowed file type',
    type: BadRequestErrorDto,
  }),
  ApiResponse({
    status: 401,
    description: 'Unauthorized - missing or invalid session',
    type: UnauthorizedErrorDto,
  }),
  ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: InternalServerErrorDto,
  }),
];

const uploadBody = ApiBody({
  schema: {
    type: 'object',
    required: ['files'],
    properties: {
      files: {
        type: 'array',
        items: { type: 'string', format: 'binary' },
        description:
          'One or more files. Allowed: jpeg, png, webp, gif, mp4, quicktime. Max 10 MB each.',
      },
    },
  },
});

// ── Upload endpoints ──────────────────────────────────────────────────────────

/**
 * POST /media-gallery/upload
 * Server-side synchronous multipart upload.
 */
export function ApiUploadMediaDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Upload files (server-side, synchronous)',
      description:
        'Upload up to 10 files through the NestJS server. ' +
        'Allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`, `video/quicktime`. ' +
        'Max size: **10 MB per file**. ' +
        'Files are uploaded to Cloudinary under `islandtours/users/<userId>` and saved to the database sequentially. ' +
        'If a DB write fails, the corresponding Cloudinary asset is rolled back.',
    }),
    ApiConsumes('multipart/form-data'),
    uploadBody,
    ApiResponse({
      status: 201,
      description: 'All files uploaded and persisted successfully',
      type: [MediaGalleryResponseDto],
    }),
    ...commonErrors,
  );
}

/**
 * POST /media-gallery/upload/async
 * Background BullMQ upload - returns immediately with job IDs.
 */
export function ApiUploadMediaAsyncDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Upload files (background queue, async)',
      description:
        'Accepts the same files as the synchronous upload but **returns immediately** ' +
        'after enqueuing a BullMQ job per file. ' +
        'Each job uploads to Cloudinary and writes to the DB with the same rollback guarantee. ' +
        'Jobs retry up to **3 times** with exponential back-off on failure. ' +
        'Uses **Upstash Redis** as the queue backend.',
    }),
    ApiConsumes('multipart/form-data'),
    uploadBody,
    ApiResponse({
      status: 201,
      description: 'Files queued for background processing',
      type: AsyncUploadResponseDto,
    }),
    ...commonErrors,
  );
}

// ── Signed / direct upload flow ───────────────────────────────────────────────

/**
 * GET /media-gallery/sign
 * Returns HMAC-signed Cloudinary upload params for direct client uploads.
 */
export function ApiGetSignedParamsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get signed Cloudinary upload parameters',
      description:
        'Generates HMAC-signed parameters that allow the **client browser to upload ' +
        'files directly to Cloudinary** without routing file bytes through the NestJS server. ' +
        'The signature covers `folder` + `timestamp` and expires in **1 hour**. ' +
        'After the upload completes, call `POST /media-gallery/confirm` to save the record.',
    }),
    ApiResponse({
      status: 200,
      description: 'Signed upload parameters returned successfully',
      type: SignedUploadParamsResponseDto,
    }),
    ApiResponse({
      status: 401,
      description: 'Unauthorized - missing or invalid session',
      type: UnauthorizedErrorDto,
    }),
    ApiResponse({
      status: 500,
      description: 'Internal Server Error',
      type: InternalServerErrorDto,
    }),
  );
}

/**
 * POST /media-gallery/confirm
 * Confirm a completed direct client upload and save to DB.
 */
export function ApiConfirmUploadDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Confirm a completed direct client upload',
      description:
        'After the client uploads a file directly to Cloudinary using signed params, ' +
        'call this endpoint with the resulting `publicId`, `url`, and `resourceType`. ' +
        'The server **verifies the asset exists** in Cloudinary (prevents spoofed IDs), ' +
        'then persists the record to the `media_gallery` table.',
    }),
    ApiResponse({
      status: 201,
      description: 'Upload confirmed and media record created',
      type: MediaGalleryResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Cloudinary asset not found for the given publicId',
      type: NotFoundErrorDto,
    }),
    ...commonErrors,
  );
}

// ── Query endpoints ───────────────────────────────────────────────────────────

/**
 * GET /media-gallery
 * Paginated list of the caller's uploaded media.
 */
export function ApiGetMyMediaDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get my media gallery (paginated)',
      description:
        'Returns a paginated list of all media uploaded by the authenticated user, ' +
        'ordered by upload date descending.',
    }),
    ApiQuery({
      name: 'page',
      required: false,
      type: Number,
      example: 1,
      description: 'Page number (1-based)',
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      example: 20,
      description: 'Items per page (max 100)',
    }),
    ApiResponse({
      status: 200,
      description: 'Paginated media gallery retrieved successfully',
      type: PaginatedMediaGalleryResponseDto,
    }),
    ...commonErrors,
  );
}

/**
 * GET /media-gallery/:id
 * Single media item owned by the caller.
 */
export function ApiGetMediaByIdDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a single media item',
      description:
        'Returns a single media record. Returns 404 if the record does not exist ' +
        'or does not belong to the authenticated user (no cross-user access).',
    }),
    ApiParam({ name: 'id', description: 'Media record UUID' }),
    ApiResponse({
      status: 200,
      description: 'Media item retrieved successfully',
      type: MediaGalleryResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Media item not found or not owned by the caller',
      type: NotFoundErrorDto,
    }),
    ...commonErrors,
  );
}

/**
 * GET /media-gallery/excluded-urls
 * Public list of URLs excluded from indexing.
 */
export function ApiGetExcludedUrlsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List media URLs excluded from indexing (public)',
      description:
        'Platform-wide list of media URLs flagged excludeFromIndexing, ' +
        'consumed by the public site SEO layer to filter og:image, ' +
        'structured data and image sitemaps.',
    }),
    ApiResponse({
      status: 200,
      description: 'Excluded URLs',
      type: [String],
    }),
  );
}

// ── Mutation endpoints ────────────────────────────────────────────────────────

/**
 * PATCH /media-gallery/:id
 * Updates editable attachment metadata.
 */
export function ApiUpdateMediaDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update media metadata',
      description:
        'Updates the editable attachment fields (title, description, altText, ' +
        'fileName, excludeFromIndexing). Ownership-scoped: 404 for records ' +
        'not owned by the caller. Empty strings clear the field.',
    }),
    ApiParam({ name: 'id', description: 'Media record UUID' }),
    ApiResponse({
      status: 200,
      description: 'Media metadata updated successfully',
      type: MediaGalleryResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Media item not found or not owned by the caller',
      type: NotFoundErrorDto,
    }),
    ...commonErrors,
  );
}

/**
 * DELETE /media-gallery/:id
 * Deletes a media record from the DB and its asset from Cloudinary.
 */
export function ApiDeleteMediaDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a media item',
      description:
        'Deletes the media record from the database **and** removes the asset from Cloudinary. ' +
        'The Cloudinary deletion is best-effort - the DB record is removed regardless. ' +
        'Returns 404 if the record does not exist or does not belong to the caller.',
    }),
    ApiParam({ name: 'id', description: 'Media record UUID' }),
    ApiResponse({
      status: 200,
      description: 'Media deleted successfully',
      type: DeleteMediaResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Media item not found or not owned by the caller',
      type: NotFoundErrorDto,
    }),
    ...commonErrors,
  );
}
