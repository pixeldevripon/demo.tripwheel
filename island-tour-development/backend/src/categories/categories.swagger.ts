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
  CategoryDetailResponseDto,
  CategoryLocalizedResponseDto,
  CategoryPageContentResponseDto,
  CategoryResponseDto,
  CategoryTranslationEntryDto,
  DeleteCategoryResponseDto,
  DeleteMessageResponseDto,
  FaqResponseDto,
  PaginatedLocalizedCategoriesResponseDto,
} from './dto/category.dto';

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
  description: 'Content locale — falls back to English when translation is missing',
});

// ── Public list / lookup ──────────────────────────────────────────────────────

export function ApiGetAllCategoriesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all categories with optional filters (public)' }),
    ApiQuery({ name: 'isActive', required: false, type: Boolean }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    localeParam,
    ApiResponse({ status: 200, type: PaginatedLocalizedCategoriesResponseDto }),
    ...publicErrors,
  );
}

export function ApiGetActiveCategoriesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all active categories (public — used by tour-creation selectors)' }),
    localeParam,
    ApiResponse({ status: 200, type: [CategoryLocalizedResponseDto] }),
    ...publicErrors,
  );
}

export function ApiGetCategoryBySlugDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get category by slug (public)' }),
    ApiParam({ name: 'slug', example: 'boat-tours' }),
    localeParam,
    ApiResponse({ status: 200, type: CategoryDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiGetCategoryByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get category by ID (public)' }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    localeParam,
    ApiResponse({ status: 200, type: CategoryDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

// ── Admin CRUD ────────────────────────────────────────────────────────────────

export function ApiCreateCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new category (Admin/Editor)',
      description:
        'Atomically creates the category, seeds 3 FeaturedSlot rows, and inserts one slug_registry row per active destination.',
    }),
    ApiResponse({ status: 201, type: CategoryResponseDto }),
    ApiResponse({ status: 409, description: 'Slug already exists', type: ConflictErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update category name or active status (Admin/Editor)',
      description: 'Slug is immutable. If isActive changes, all slug_registry rows update accordingly.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiResponse({ status: 200, type: CategoryResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Deactivate a category (Admin/Editor)',
      description:
        'Soft-delete: sets isActive = false. FeaturedSlot rows are never deleted. Seeded categories and those with active trips are blocked.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiResponse({ status: 200, type: DeleteCategoryResponseDto }),
    ApiResponse({ status: 403, description: 'Seeded category', type: ForbiddenErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({ status: 409, description: 'Category has active trips', type: ConflictErrorDto }),
    ...adminErrors,
  );
}

// ── Translation management ────────────────────────────────────────────────────

export function ApiGetAllTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get all translations for a category (Admin/Editor)',
      description: 'Returns all available locales and their translated fields.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiResponse({ status: 200, type: [CategoryTranslationEntryDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiGetTranslationsByLocaleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get translations for a specific locale (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: CategoryTranslationEntryDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpsertTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Patch translations for a locale (Admin/Editor)',
      description:
        'Creates or updates translated fields for the given locale. Only supplied fields are written — omitted fields are left unchanged.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: CategoryTranslationEntryDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete all translations for a locale (Admin/Editor)',
      description: 'Removes every translated field row for the given locale. English ("en") cannot be deleted via this endpoint — update the category name field instead.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
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
      summary: 'Get editorial page content for a category (public)',
      description: 'Returns about text, meta title, and meta description for the requested locale.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    localeParam,
    ApiResponse({ status: 200, type: CategoryPageContentResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiUpsertPageContentDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Patch editorial page content for a locale (Admin/Editor)',
      description: 'Creates or updates about text, meta title, and meta description. Only supplied fields are written — omitted fields are left unchanged.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: Locale.nl }),
    ApiResponse({ status: 200, type: CategoryPageContentResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── FAQ ───────────────────────────────────────────────────────────────────────

export function ApiGetFaqsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get active FAQs for a category (public)',
      description: 'Returns active FAQ items. Pass ?locale= to filter by locale; omit to return all locales.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiQuery({ name: 'locale', required: false, enum: Locale, example: Locale.en }),
    ApiResponse({ status: 200, type: [FaqResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiCreateFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a FAQ item for a category (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiResponse({ status: 201, type: FaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a FAQ item (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: FaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a FAQ item (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}
