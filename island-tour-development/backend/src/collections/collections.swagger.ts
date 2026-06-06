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
  CollectionResponseDto,
  CollectionTranslationEntryDto,
  DeleteMessageResponseDto,
  FaqResponseDto,
} from './dto/collection.dto';

const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });
const publicErrors = [serverError];
const commonErrors = [
  ApiResponse({ status: 400, type: BadRequestErrorDto }),
  ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
  serverError,
];
const adminErrors = [...commonErrors, ApiResponse({ status: 403, type: ForbiddenErrorDto })];
const localeQuery = ApiQuery({ name: 'locale', required: false, enum: Locale, example: 'en' });

// ── Public ────────────────────────────────────────────────────────────────────

export function ApiGetActiveCollectionsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List active collections for a destination (public)' }),
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
      description: 'MANUAL → ordered tourIds; DYNAMIC → filterQuery resolved via the tour-listing engine.',
    }),
    ApiParam({ name: 'slug', example: 'top-10-tours' }),
    ApiQuery({ name: 'destinationSlug', required: true, example: 'curacao' }),
    localeQuery,
    ApiResponse({ status: 200, type: CollectionDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiGetCollectionPageContentDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get collection SEO/editorial page content (public)' }),
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
    ApiResponse({ status: 200, type: [FaqResponseDto] }),
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
    ApiResponse({ status: 409, description: 'Slug collides with a category or already exists', type: ConflictErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateCollectionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a collection (Admin). Slug is immutable.' }),
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
    ApiOperation({ summary: 'Delete a collection translation (non-EN) (Admin)' }),
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
    ApiResponse({ status: 201, type: FaqResponseDto }),
    ...adminErrors,
  );
}

export function ApiUpdateCollectionFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a collection FAQ (Admin)' }),
    ApiParam({ name: 'id', description: 'Collection UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: FaqResponseDto }),
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
