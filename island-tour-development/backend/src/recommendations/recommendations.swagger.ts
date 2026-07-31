import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  PublicRecommendationResponseDto,
  RecommendationCategoryResponseDto,
  RecommendationResponseDto,
  RecommendationTranslationEntryDto,
} from './dto/recommendation.dto';

const commonErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request - Invalid input data',
    type: BadRequestErrorDto,
  }),
  ApiResponse({
    status: 401,
    description: 'Unauthorized - Missing or invalid authentication',
    type: UnauthorizedErrorDto,
  }),
  ApiResponse({
    status: 500,
    description: 'Internal Server Error',
    type: InternalServerErrorDto,
  }),
];

const adminErrors = [
  ...commonErrors,
  ApiResponse({
    status: 403,
    description: 'Forbidden - requires MANAGE_EDITORIAL',
    type: ForbiddenErrorDto,
  }),
];

const notFound = ApiResponse({
  status: 404,
  description: 'Recommendation not found',
  type: NotFoundErrorDto,
});

// ── Recommendations ───────────────────────────────────────────────────────────

export function ApiGetPublicRecommendationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Get the featured recommendation for a surface + locale (no auth)',
      description:
        'Each surface renders ONE card, so this returns one recommendation: the ' +
        'first enabled, complete one placed on that surface by displayOrder. Never ' +
        '404s. `enabled` is the whole contract - false when none qualifies, with ' +
        'every other field null, so the page hides the section. EXTERNAL cards link ' +
        'off-site (`external: true`); INTERNAL cards are rendered from the live ' +
        'entity and link same-tab via a site-relative path.',
    }),
    ApiResponse({
      status: 200,
      description: 'Featured recommendation retrieved successfully',
      type: PublicRecommendationResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiListRecommendationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List every recommendation in promotion order (admin)',
      description:
        'Ordered by displayOrder then id. `featuredPlacements` names the surfaces ' +
        'each row currently wins (one winner per surface).',
    }),
    ApiResponse({
      status: 200,
      description: 'Recommendations retrieved successfully',
      type: [RecommendationResponseDto],
    }),
    ...adminErrors,
  );
}

export function ApiGetRecommendationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get one recommendation with every locale (admin)',
    }),
    ApiResponse({
      status: 200,
      description: 'Recommendation retrieved successfully',
      type: RecommendationResponseDto,
    }),
    ...adminErrors,
    notFound,
  );
}

export function ApiCreateRecommendationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a recommendation (admin)',
      description:
        'EXTERNAL needs a title (written in the same transaction); INTERNAL needs ' +
        'refType + refId and follows the live entity. A row missing its essentials ' +
        'is created incomplete and simply is not featured until they are filled in.',
    }),
    ApiResponse({
      status: 201,
      description: 'Recommendation created successfully',
      type: RecommendationResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateRecommendationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update the locale-agnostic recommendation fields (admin)',
      description:
        'Only the named fields are touched; an explicit null clears one. Clearing ' +
        'an essential takes the row out of the running and the card passes to the ' +
        'next enabled, complete one on that surface.',
    }),
    ApiResponse({
      status: 200,
      description: 'Recommendation updated successfully',
      type: RecommendationResponseDto,
    }),
    ...adminErrors,
    notFound,
  );
}

export function ApiDeleteRecommendationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a recommendation (admin)',
      description:
        'Hard delete; its translations go with it. SEEDED rows are refused with a ' +
        '403 - switch them off instead.',
    }),
    ApiResponse({
      status: 200,
      description: 'Recommendation deleted successfully',
    }),
    ApiResponse({
      status: 403,
      description:
        'Forbidden - requires MANAGE_EDITORIAL, or the recommendation is seeded',
      type: ForbiddenErrorDto,
    }),
    ...commonErrors,
    notFound,
  );
}

export function ApiGetRecommendationTranslationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "List one recommendation's copy for every locale (admin)",
    }),
    ApiResponse({
      status: 200,
      description: 'Translations retrieved successfully',
      type: [RecommendationTranslationEntryDto],
    }),
    ...adminErrors,
    notFound,
  );
}

export function ApiUpsertRecommendationTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        "Create or update one recommendation's copy for one locale (admin)",
      description:
        'Fields are wrapped in a `fields` object, matching every other translatable ' +
        'entity. Sending a field as null clears it. Clearing the English title takes ' +
        'an EXTERNAL recommendation out of the running.',
    }),
    ApiResponse({
      status: 200,
      description: 'Translation saved successfully',
      type: RecommendationTranslationEntryDto,
    }),
    ...adminErrors,
    notFound,
  );
}

// ── Categories ────────────────────────────────────────────────────────────────

const categoryNotFound = ApiResponse({
  status: 404,
  description: 'Category not found',
  type: NotFoundErrorDto,
});

export function ApiListRecommendationCategoriesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List recommendation categories (admin)' }),
    ApiResponse({
      status: 200,
      description: 'Categories retrieved successfully',
      type: [RecommendationCategoryResponseDto],
    }),
    ...adminErrors,
  );
}

export function ApiCreateRecommendationCategoryDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Create a recommendation category (admin)' }),
    ApiResponse({
      status: 201,
      description: 'Category created successfully',
      type: RecommendationCategoryResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - a category with that slug already exists',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateRecommendationCategoryDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a recommendation category (admin)' }),
    ApiResponse({
      status: 200,
      description: 'Category updated successfully',
      type: RecommendationCategoryResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: 'Conflict - a category with that slug already exists',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
    categoryNotFound,
  );
}

export function ApiDeleteRecommendationCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a recommendation category (admin)',
      description:
        'Recommendations filed under it fall back to uncategorised (FK SetNull). ' +
        'SEEDED categories are refused with a 403.',
    }),
    ApiResponse({ status: 200, description: 'Category deleted successfully' }),
    ...adminErrors,
    categoryNotFound,
  );
}
