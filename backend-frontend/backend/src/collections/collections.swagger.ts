import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { Locale } from '@/common/constants/locales';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  CollectionDetailResponseDto,
  CollectionLocalizedResponseDto,
  CollectionPageContentResponseDto,
  CollectionRenderResponseDto,
  CollectionResponseDto,
  CollectionTourEntryDto,
  CollectionTourRationaleResponseDto,
  CollectionTranslationEntryDto,
  DeleteMessageResponseDto,
  CollectionFaqResponseDto,
} from './dto/collection.dto';

const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });
const publicErrors = [serverError];
const commonErrors = [
  ApiResponse({ status: 400, type: BadRequestErrorDto }),
  ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
  serverError,
];
const adminErrors = [
  ...commonErrors,
  ApiResponse({ status: 403, type: ForbiddenErrorDto }),
];
const localeQuery = ApiQuery({
  name: 'locale',
  required: false,
  enum: Locale,
  example: 'en',
});

// ── Public ────────────────────────────────────────────────────────────────────

export function ApiGetActiveCollectionsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List active collections for a destination (public)',
    }),
    ApiQuery({ name: 'destinationSlug', required: true, example: 'curacao' }),
    localeQuery,
    ApiResponse({ status: 200, type: [CollectionLocalizedResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiGetCollectionBySlugDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a collection page + resolved tours (public)',
      description:
        'MANUAL → ordered tourIds; DYNAMIC → filterQuery resolved via the tour-listing engine.',
    }),
    ApiParam({ name: 'slug', example: 'top-10-tours' }),
    ApiQuery({ name: 'destinationSlug', required: true, example: 'curacao' }),
    localeQuery,
    ApiResponse({ status: 200, type: CollectionDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiRenderCollectionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Render a published collection page (public, §10)',
      description:
        'Returns the full render payload: localized banner copy (eyebrow/curationNote/H1/overview), ' +
        'resolved tours (MANUAL ordered with per-tour rationale[locale] fallback en; DYNAMIC via filterQuery + sortOrder), ' +
        'fast stats (tourCount + min fromPrice), FAQs, and up to 3 related published collections. ' +
        'Only PUBLISHED + active collections render (404 otherwise).',
    }),
    ApiParam({ name: 'slug', example: 'best-things-to-do' }),
    ApiQuery({
      name: 'destinationId',
      required: true,
      example: 'a1b2c3d4-0000-0000-0000-000000000001',
    }),
    localeQuery,
    ApiResponse({ status: 200, type: CollectionRenderResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiGetCollectionPageContentDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get collection SEO/editorial page content (public)',
    }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    localeQuery,
    ApiResponse({ status: 200, type: CollectionPageContentResponseDto }),
    ...publicErrors,
  );
}

export function ApiGetCollectionFaqsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get collection FAQs (public)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    localeQuery,
    ApiResponse({ status: 200, type: [CollectionFaqResponseDto] }),
    ...publicErrors,
  );
}

// ── Admin ─────────────────────────────────────────────────────────────────────

export function ApiCreateCollectionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a collection (Admin)',
      description:
        'Writes a COLLECTION slug_registry row in the same transaction. Slug must NOT equal a category slug ' +
        '(cannibalization guard). MANUAL requires tourIds; DYNAMIC requires filterQuery.',
    }),
    ApiResponse({ status: 201, type: CollectionResponseDto }),
    ApiResponse({
      status: 409,
      description: 'Slug collides with a category or already exists',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateCollectionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a collection (Admin). Slug is immutable.',
    }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiResponse({ status: 200, type: CollectionResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteCollectionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Deactivate a collection (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiForceDeleteCollectionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Permanently delete a collection (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiGetCollectionTranslationsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all collection translations (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiResponse({ status: 200, type: [CollectionTranslationEntryDto] }),
    ...adminErrors,
  );
}

export function ApiGetCollectionTranslationByLocaleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a collection translation by locale (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiParam({ name: 'locale', enum: Locale }),
    ApiResponse({ status: 200, type: CollectionTranslationEntryDto }),
    ...adminErrors,
  );
}

export function ApiUpsertCollectionTranslationsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Create/update a collection translation (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiParam({ name: 'locale', enum: Locale }),
    ApiResponse({ status: 200, type: CollectionTranslationEntryDto }),
    ...adminErrors,
  );
}

export function ApiDeleteCollectionTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a collection translation (non-EN) (Admin)',
    }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiParam({ name: 'locale', enum: Locale }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...adminErrors,
  );
}

export function ApiUpsertCollectionPageContentDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Create/update collection page content (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiParam({ name: 'locale', enum: Locale }),
    ApiResponse({ status: 200, type: CollectionPageContentResponseDto }),
    ...adminErrors,
  );
}

export function ApiCreateCollectionFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a collection FAQ (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiResponse({ status: 201, type: CollectionFaqResponseDto }),
    ...adminErrors,
  );
}

export function ApiUpdateCollectionFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a collection FAQ (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: CollectionFaqResponseDto }),
    ...adminErrors,
  );
}

export function ApiDeleteCollectionFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a collection FAQ (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...adminErrors,
  );
}

export function ApiReplaceCollectionToursDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Replace ordered MANUAL membership (Admin)',
      description:
        'Writes CollectionTour rows (position re-normalized 0..n by the submitted order) and keeps tourIds[] in sync. ' +
        'Existing members not in the payload are removed. MANUAL collections only.',
    }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiResponse({ status: 200, type: [CollectionTourEntryDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpsertCollectionTourRationaleDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Upsert a per-tour, per-locale collection rationale (Admin)',
      description:
        'Max 20 words (400 otherwise). The tour must already be a member of the collection.',
    }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiParam({ name: 'tourId', description: 'Tour UUID' }),
    ApiParam({ name: 'locale', enum: Locale }),
    ApiResponse({ status: 200, type: CollectionTourRationaleResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateCollectionStatusDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Transition a collection status (Admin) - DRAFT/PUBLISHED/ARCHIVED',
      description:
        'Publish guard (G5): DRAFT→PUBLISHED requires heroImage, base-locale (en) H1 + overview, and ' +
        '(MANUAL only) a valid base-locale rationale on every member tour. Throws 422 listing what is missing.',
    }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiResponse({ status: 200, type: CollectionResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({
      status: 422,
      description: 'Collection is not publishable',
      type: BadRequestErrorDto,
    }),
    ...adminErrors,
  );
}
