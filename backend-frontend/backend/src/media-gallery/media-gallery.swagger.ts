import {
  BadRequestErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { Locale } from '@/common/constants/locales';
import { GenerateTranslationResponseDto } from '@/content-translation/dto/content-translation.dto';
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
  MEDIA_SEO_MAX_URLS,
  MediaGalleryResponseDto,
  MediaSeoResponseDto,
  MediaTranslationResponseDto,
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

/**
 * GET /media-gallery/seo
 */
export function ApiGetMediaSeoDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Localized SEO copy for a batch of image URLs (public)',
      description:
        'Title, description and alt text for the given image URLs in the requested ' +
        'locale, each field falling back to English on its own when the translation ' +
        'is missing or was deliberately cleared. Entity tables store only an image ' +
        'URL and no media id, so the URL is the join key. Query strings are ignored ' +
        'when matching (every Cloudinary URL carries an `?_a=` analytics param, and ' +
        'the entity row and the library row need not carry the same one), and the ' +
        '`url` returned is the query-stripped form to look results up by. Assets ' +
        'flagged excludeFromIndexing are still returned - alt text is an ' +
        'accessibility need regardless of indexability.',
    }),
    ApiResponse({
      status: 200,
      description: 'Localized copy, one entry per matched asset',
      type: [MediaSeoResponseDto],
    }),
    ApiResponse({
      status: 400,
      description: `No url given, or more than ${MEDIA_SEO_MAX_URLS}`,
      type: BadRequestErrorDto,
    }),
  );
}

/**
 * GET /media-gallery/:id/translations
 */
export function ApiGetMediaTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Every stored locale for one asset',
      description:
        "All per-locale copy for one attachment, for the dashboard's inline locale " +
        'switcher. Takes NO locale param on purpose - the editor needs them all at ' +
        'once, and a defaulted locale filter is what made a comparable editor ' +
        'silently show English only. English is absent by construction: it lives on ' +
        'the asset row itself and is edited through PATCH /media-gallery/:id.',
    }),
    ApiParam({ name: 'id', description: 'Media id' }),
    ApiResponse({
      status: 200,
      description: 'Stored locales, ascending',
      type: [MediaTranslationResponseDto],
    }),
    ApiResponse({
      status: 404,
      description: 'Not found, or outside the caller media scope',
      type: NotFoundErrorDto,
    }),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
  );
}

/**
 * PATCH /media-gallery/:id/translations/:locale
 */
export function ApiUpsertMediaTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "Save one locale's copy for one asset",
      description:
        'Upserts title / description / alt text for a single locale. An empty ' +
        'string CLEARS the field to null and keeps the row - the surviving row is ' +
        'flagged human, which is what stops the AI refilling a field the editor ' +
        'deliberately emptied, and the public page falls back to English for it. ' +
        'Rejects `en`: English is the source every other locale falls back to.',
    }),
    ApiParam({ name: 'id', description: 'Media id' }),
    ApiParam({
      name: 'locale',
      enum: Locale,
      description: 'Target locale, not en',
    }),
    ApiResponse({
      status: 200,
      description: 'The saved locale row',
      type: MediaTranslationResponseDto,
    }),
    ApiResponse({
      status: 400,
      description: 'locale=en, or an invalid locale / field length',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Not found, or outside the caller media scope',
      type: NotFoundErrorDto,
    }),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
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

/**
 * POST /media-gallery/:id/translations/:locale/generate
 */
export function ApiGenerateMediaTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "Translate one asset's copy into one locale with AI",
      description:
        'Synchronous, single asset, single locale - one provider call. The ' +
        'background path deliberately batches a whole bucket of assets instead; ' +
        'this is the on-demand button in the media viewer. A human-saved locale ' +
        'row is left untouched unless `force=true`, so the button cannot quietly ' +
        'undo an editor edit. Scoped to the caller media library.',
    }),
    ApiParam({ name: 'id', description: 'Media id' }),
    ApiParam({
      name: 'locale',
      enum: Locale,
      description: 'Target locale, not en',
    }),
    ApiQuery({
      name: 'force',
      required: false,
      type: Boolean,
      description:
        'Re-translate and re-stamp even a human-saved row. Needs an explicit confirmation in the UI.',
    }),
    ApiResponse({
      status: 201,
      description: 'What was written / skipped',
      type: GenerateTranslationResponseDto,
    }),
    ApiResponse({
      status: 400,
      description:
        'locale=en, an invalid locale, or AI translation unconfigured',
      type: BadRequestErrorDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Not found, or outside the caller media scope',
      type: NotFoundErrorDto,
    }),
    ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
  );
}
