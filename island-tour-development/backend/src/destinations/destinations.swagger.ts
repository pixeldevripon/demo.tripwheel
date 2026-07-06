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
  DeleteDestinationResponseDto,
  DeleteMessageResponseDto,
  DestinationActiveResponseDto,
  DestinationDetailResponseDto,
  DestinationLocalizedResponseDto,
  DestinationPageContentResponseDto,
  DestinationResponseDto,
  DestinationTranslationEntryDto,
  FaqResponseDto,
  PaginatedLocalizedDestinationsResponseDto,
} from './dto/destination.dto';
import { FaqGroupResponseDto } from '@/common/faq/dto/faq-group.dto';

// ── Shared error sets ─────────────────────────────────────────────────────────

const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });

const publicErrors = [serverError];

const commonErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: BadRequestErrorDto,
  }),
  ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorDto,
  }),
  serverError,
];

const adminErrors = [
  ...commonErrors,
  ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ForbiddenErrorDto,
  }),
];

const localeParam = ApiQuery({
  name: 'locale',
  required: false,
  enum: Locale,
  example: 'en',
  description:
    'Content locale - falls back to English when translation is missing',
});

// ── Public list / lookup ──────────────────────────────────────────────────────

export function ApiGetAllDestinationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all destinations with optional filters (public)',
    }),
    ApiQuery({ name: 'isActive', required: false, type: Boolean }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    localeParam,
    ApiResponse({
      status: 200,
      type: PaginatedLocalizedDestinationsResponseDto,
    }),
    ...publicErrors,
  );
}

export function ApiGetActiveDestinationsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all active destinations (public)' }),
    localeParam,
    ApiResponse({ status: 200, type: [DestinationActiveResponseDto] }),
    ...publicErrors,
  );
}

export function ApiGetDestinationBySlugDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get destination by slug (public)' }),
    ApiParam({ name: 'slug', example: 'curacao' }),
    localeParam,
    ApiResponse({ status: 200, type: DestinationDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiGetDestinationByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get destination by ID (public)' }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    localeParam,
    ApiResponse({ status: 200, type: DestinationDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

export function ApiCreateDestinationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new destination (Admin/Editor)',
      description:
        'Atomically creates the destination, seeds one RESERVED slug_registry row for "tours", ' +
        'and seeds one CATEGORY slug_registry row per existing active category. ' +
        'Requires `region` (V2 §2) and accepts the geo/SEO fields: country, latitude, longitude, ' +
        'timezone, currency, language, galleryImages, ogImage, parentDestinationId.',
    }),
    ApiResponse({ status: 201, type: DestinationResponseDto }),
    ApiResponse({
      status: 409,
      description: 'Slug already exists',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateDestinationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update destination fields (Admin/Editor)',
      description:
        'Updates any of: name, heroImage, region, country, latitude, longitude, timezone, currency, ' +
        'language, galleryImages, ogImage, isActive. Slug is immutable. ' +
        'If isActive changes, all slug_registry rows update accordingly.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({ status: 200, type: DestinationResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiForceDeleteDestinationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Permanently delete a destination (Admin only)',
      description:
        'Hard delete. Removes the destination and all related data (hubs, translations, FAQs, page content, slug registry rows). Seeded destinations are protected. This action is irreversible.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({
      status: 200,
      description: 'Destination permanently deleted',
    }),
    ApiResponse({
      status: 403,
      description: 'Seeded destination',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteDestinationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Deactivate a destination (Admin/Editor)',
      description:
        'Soft-delete: sets isActive = false. Seeded destinations and those with active trips are blocked.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({ status: 200, type: DeleteDestinationResponseDto }),
    ApiResponse({
      status: 403,
      description: 'Seeded destination',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({
      status: 409,
      description: 'Destination has active trips',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

// ── Translation management ────────────────────────────────────────────────────

export function ApiGetAllTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all translations for a destination (Admin/Editor)',
      description: 'Returns all available locales and their translated fields.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({ status: 200, type: [DestinationTranslationEntryDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiGetTranslationsByLocaleDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get translations for a specific locale (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: DestinationTranslationEntryDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpsertTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Patch translations for a locale (Admin/Editor)',
      description:
        'Creates or updates translated fields for the given locale. Only supplied fields are written - omitted fields are left unchanged. ' +
        'Destination names are proper nouns - set isMachineTranslated to false.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: DestinationTranslationEntryDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete all translations for a locale (Admin/Editor)',
      description:
        'Removes every translated field row for the given locale. English ("en") cannot be deleted via this endpoint - update the destination name field instead.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── Page Content ──────────────────────────────────────────────────────────────

export function ApiGetPageContentDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get editorial page content for a destination (public)',
      description:
        'Returns about text, meta title, and meta description for the requested locale.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    localeParam,
    ApiResponse({ status: 200, type: DestinationPageContentResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiUpsertPageContentDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Patch editorial page content for a locale (Admin/Editor)',
      description:
        'Creates or updates about text, meta title, and meta description. Only supplied fields are written - omitted fields are left unchanged.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: DestinationPageContentResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export function ApiGetFaqsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get active FAQs for a destination (public)',
      description:
        'Returns active FAQ items. Pass ?locale= to filter by locale; omit to return all locales.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiQuery({
      name: 'locale',
      required: false,
      enum: Locale,
      example: Locale.en,
    }),
    ApiResponse({ status: 200, type: [FaqResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiCreateFaqDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a FAQ item for a destination (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({ status: 201, type: FaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a FAQ item (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: FaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a FAQ item (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── Grouped FAQ (add in English, then translate) ────────────────────────────

export function ApiGetFaqGroupsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get FAQs grouped by locale for a destination (Admin/Editor)',
      description:
        'Returns each logical FAQ once, with its per-locale translations nested. Powers the dashboard "add in English, then translate" editor.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({ status: 200, type: [FaqGroupResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiCreateFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a FAQ (English base) for a destination (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({ status: 201, type: FaqGroupResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a FAQ group (display order / active) (Admin/Editor)',
      description: 'Applies to every locale row of the FAQ at once.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiParam({ name: 'groupId', description: 'FAQ group UUID' }),
    ApiResponse({ status: 200, type: FaqGroupResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a FAQ and all its translations (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiParam({ name: 'groupId', description: 'FAQ group UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpsertFaqTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add or update a FAQ translation for one locale (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiParam({ name: 'groupId', description: 'FAQ group UUID' }),
    ApiParam({ name: 'locale', enum: Locale, description: 'Target locale' }),
    ApiResponse({ status: 200, type: FaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}
