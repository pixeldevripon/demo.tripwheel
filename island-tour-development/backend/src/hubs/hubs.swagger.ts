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
  AddAllowedCategoryResponseDto,
  AllowedCategoryItemDto,
  DeleteHubResponseDto,
  DeleteMessageResponseDto,
  FaqResponseDto,
  HubDetailLocalizedResponseDto,
  HubPageContentResponseDto,
  HubTranslationEntryDto,
  PaginatedLocalizedHubsResponseDto,
  RemoveAllowedCategoryResponseDto,
} from './dto/hub.dto';

// ── Shared error sets ─────────────────────────────────────────────────────────

const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });

const publicErrors = [serverError];

const commonErrors = [
  ApiResponse({ status: 400, description: 'Bad Request', type: BadRequestErrorDto }),
  ApiResponse({ status: 401, description: 'Unauthorized', type: UnauthorizedErrorDto }),
  serverError,
];

const adminErrors = [
  ...commonErrors,
  ApiResponse({ status: 403, description: 'Forbidden', type: ForbiddenErrorDto }),
];

const localeParam = ApiQuery({
  name: 'locale',
  required: false,
  enum: Locale,
  example: 'en',
  description: 'Content locale - falls back to English when translation is missing',
});

// ── Public list / lookup ──────────────────────────────────────────────────────

export function ApiGetAllHubsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all hubs with optional filters (public)',
      description: 'Public paginated list. Supports filtering by destinationId and isActive.',
    }),
    ApiQuery({ name: 'destinationId', required: false, type: String }),
    ApiQuery({ name: 'isActive', required: false, type: Boolean }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    localeParam,
    ApiResponse({ status: 200, type: PaginatedLocalizedHubsResponseDto }),
    ...publicErrors,
  );
}

export function ApiGetActiveHubsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all active hubs (public)',
      description: 'Returns all active hubs without pagination. Optionally filter by destinationId.',
    }),
    ApiQuery({ name: 'destinationId', required: false, type: String }),
    localeParam,
    ApiResponse({ status: 200, type: [HubDetailLocalizedResponseDto] }),
    ...publicErrors,
  );
}

export function ApiGetHubBySlugDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a hub by slug (public)',
      description:
        'Hub slugs are unique per destination, so `destinationSlug` is required. ' +
        'Example: GET /hubs/slug/klein-curacao?destinationSlug=curacao',
    }),
    ApiParam({ name: 'slug', description: 'Hub slug', example: 'klein-curacao' }),
    ApiQuery({ name: 'destinationSlug', required: true, example: 'curacao', description: 'Destination slug' }),
    localeParam,
    ApiResponse({ status: 200, type: HubDetailLocalizedResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiGetHubByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a hub by UUID (public)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    localeParam,
    ApiResponse({ status: 200, type: HubDetailLocalizedResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

export function ApiCreateHubDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new hub (Admin/Editor)',
      description:
        'Atomically creates the hub and seeds one slug_registry row for its destination. ' +
        'Requires `hubType` (location | highlight | area - V2 §5) and accepts latitude/longitude. ' +
        'Optionally seeds allowed categories in the same transaction.',
    }),
    ApiResponse({ status: 201, type: HubDetailLocalizedResponseDto }),
    ApiResponse({ status: 404, description: 'Destination not found', type: NotFoundErrorDto }),
    ApiResponse({ status: 409, description: 'Hub slug already exists for this destination', type: ConflictErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateHubDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a hub (Admin/Editor)',
      description:
        'Updates any of: name, description, hubType, latitude, longitude, active status. Slug is immutable. ' +
        'If isActive changes, the slug_registry row is mirrored in the same transaction.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: HubDetailLocalizedResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteHubDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Deactivate a hub (Admin/Editor)',
      description:
        'Soft-delete: sets isActive = false on the hub and its slug_registry row. ' +
        'Seeded hubs and those with existing trips are blocked.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: DeleteHubResponseDto }),
    ApiResponse({ status: 403, type: ForbiddenErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({ status: 409, type: ConflictErrorDto }),
    ...adminErrors,
  );
}

// ── Allowed categories ────────────────────────────────────────────────────────

export function ApiGetAllowedCategoriesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get allowed categories for a hub (public)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: [AllowedCategoryItemDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiAddAllowedCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add an allowed category to a hub (Admin/Editor)',
      description: "Adds a category to the hub's allowed set. Operators can only assign this category to trips in this hub.",
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 201, type: AddAllowedCategoryResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({ status: 409, description: 'Category already allowed for this hub', type: ConflictErrorDto }),
    ...adminErrors,
  );
}

export function ApiRemoveAllowedCategoryDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an allowed category from a hub (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'categoryId', description: 'Category UUID' }),
    ApiResponse({ status: 200, type: RemoveAllowedCategoryResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── Translation management ────────────────────────────────────────────────────

export function ApiGetAllTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all translations for a hub (Admin/Editor)',
      description: 'Returns all available locales and their translated fields.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: [HubTranslationEntryDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiGetTranslationsByLocaleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get translations for a specific locale (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: HubTranslationEntryDto }),
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
        'Hub names are proper nouns - set isMachineTranslated to false.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: HubTranslationEntryDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete all translations for a locale (Admin/Editor)',
      description:
        'Removes every translated field row for the given locale. English ("en") cannot be deleted via this endpoint - update the hub name field instead.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
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
      summary: 'Get editorial page content for a hub (public)',
      description: 'Returns about text, meta title, and meta description for the requested locale.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    localeParam,
    ApiResponse({ status: 200, type: HubPageContentResponseDto }),
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
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: HubPageContentResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export function ApiGetFaqsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get active FAQs for a hub (public)',
      description: 'Returns active FAQ items. Pass ?locale= to filter by locale; omit to return all locales.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiQuery({ name: 'locale', required: false, enum: Locale, example: Locale.en }),
    ApiResponse({ status: 200, type: [FaqResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiCreateFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a FAQ item for a hub (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 201, type: FaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a FAQ item (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: FaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a FAQ item (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}
