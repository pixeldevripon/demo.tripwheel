import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { Locale } from '@/common/constants/locales';
import { FaqGroupResponseDto } from '@/common/faq/dto/faq-group.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  CategoryByDestinationResponseDto,
  CategoryDetailByDestinationResponseDto,
  CategoryDetailResponseDto,
  CategoryLocalizedResponseDto,
  CategoryPageContentResponseDto,
  CategoryResponseDto,
  CategoryTranslationEntryDto,
  DeleteCategoryResponseDto,
  DeleteMessageResponseDto,
  CategoryFaqResponseDto,
  PaginatedLocalizedCategoriesResponseDto,
} from './dto/category.dto';

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

export function ApiGetAllCategoriesDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all categories with optional filters (public)',
    }),
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
    ApiOperation({
      summary:
        'List all active categories (public - used by tour-creation selectors)',
    }),
    localeParam,
    ApiResponse({ status: 200, type: [CategoryLocalizedResponseDto] }),
    ...publicErrors,
  );
}

export function ApiGetCategoriesByDestinationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'List categories that have ≥1 published tour in a destination (public)',
      description:
        'V2 §3 tour-gating: only categories with at least one LIVE tour in the destination are returned, ' +
        'each with publishedTourCount, ordered by sortOrder. Used for destination-page nav/listing and sitemaps.',
    }),
    ApiParam({ name: 'destinationSlug', example: 'curacao' }),
    localeParam,
    ApiResponse({ status: 200, type: [CategoryByDestinationResponseDto] }),
    ApiResponse({
      status: 404,
      description: 'Destination not found',
      type: NotFoundErrorDto,
    }),
    ...publicErrors,
  );
}

export function ApiGetCategoryByDestinationSlugDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a category page for a destination (public, tour-gated)',
      description:
        'V2 §3: returns 404 when the (category, destination) pair has zero published tours - empty category ' +
        'pages must not render. The slug stays reserved in slug_registry; only the page is gated.',
    }),
    ApiParam({ name: 'destinationSlug', example: 'curacao' }),
    ApiParam({ name: 'categorySlug', example: 'boat-tours' }),
    localeParam,
    ApiResponse({ status: 200, type: CategoryDetailByDestinationResponseDto }),
    ApiResponse({
      status: 404,
      description: 'Destination/category not found or no published tours',
      type: NotFoundErrorDto,
    }),
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
        'Atomically creates the category and inserts one slug_registry row per active destination. ' +
        'Accepts the V2 fields: description, icon, sortOrder, parentCategoryId.',
    }),
    ApiResponse({ status: 201, type: CategoryResponseDto }),
    ApiResponse({
      status: 409,
      description: 'Slug already exists',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update category fields (Admin/Editor)',
      description:
        'Updates any of: name, heroImage, description, icon, sortOrder, ' +
        'parentCategoryId, isActive. Slug is immutable. ' +
        'If isActive changes, all slug_registry rows update accordingly.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiResponse({ status: 200, type: CategoryResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiForceDeleteCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Permanently delete a category (Admin only)',
      description:
        'Hard delete. Removes the category and all related data (translations, FAQs, page content, slug registry rows). Seeded categories are protected. This action is irreversible.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiResponse({ status: 200, description: 'Category permanently deleted' }),
    ApiResponse({
      status: 403,
      description: 'Seeded category',
      type: ForbiddenErrorDto,
    }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Deactivate a category (Admin/Editor)',
      description:
        'Soft-delete: sets isActive = false. Seeded categories and those with active trips are blocked.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiResponse({ status: 200, type: DeleteCategoryResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({
      status: 409,
      description: 'Category has active trips',
      type: ConflictErrorDto,
    }),
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
    ApiOperation({
      summary: 'Get translations for a specific locale (Admin/Editor)',
    }),
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
        'Creates or updates translated fields for the given locale. Only supplied fields are written - omitted fields are left unchanged.',
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
      description:
        'Removes every translated field row for the given locale. English ("en") cannot be deleted via this endpoint - update the category name field instead.',
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
      description:
        'Returns about text, meta title, and meta description for the requested locale.',
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
      description:
        'Creates or updates about text, meta title, and meta description. Only supplied fields are written - omitted fields are left unchanged.',
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
      description:
        'Returns active FAQ items. Pass ?locale= to filter by locale; omit to return all locales.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiQuery({
      name: 'locale',
      required: false,
      enum: Locale,
      example: Locale.en,
    }),
    ApiResponse({ status: 200, type: [CategoryFaqResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiCreateFaqDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a FAQ item for a category (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiResponse({ status: 201, type: CategoryFaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateFaqDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a FAQ item (Admin/Editor)' }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiParam({ name: 'faqId', description: 'FAQ UUID' }),
    ApiResponse({ status: 200, type: CategoryFaqResponseDto }),
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

// ── Grouped FAQ (add in English, then translate) ──────────────────────────────

export function ApiGetFaqGroupsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get FAQs grouped by locale for a category (Admin/Editor)',
      description:
        'Returns each logical FAQ once, with its per-locale translations nested. Powers the dashboard "add in English, then translate" editor.',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiResponse({ status: 200, type: [FaqGroupResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiCreateFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a FAQ (English base) for a category (Admin/Editor)',
    }),
    ApiParam({ name: 'id', description: 'Category UUID' }),
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
    ApiParam({ name: 'id', description: 'Category UUID' }),
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
    ApiParam({ name: 'id', description: 'Category UUID' }),
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
    ApiParam({ name: 'id', description: 'Category UUID' }),
    ApiParam({ name: 'groupId', description: 'FAQ group UUID' }),
    ApiParam({ name: 'locale', enum: Locale, description: 'Target locale' }),
    ApiResponse({ status: 200, type: CategoryFaqResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}
