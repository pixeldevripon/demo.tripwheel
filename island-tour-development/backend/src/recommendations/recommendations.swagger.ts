import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  PublicRecommendationResponseDto,
  RecommendationResponseDto,
  RecommendationSettingsResponseDto,
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
        'Get the featured recommendations for a surface + locale (no auth)',
      description:
        'Each surface renders a short SECTION, so this returns up to 3 ' +
        'recommendations: the enabled, complete ones placed on that surface, in ' +
        'promotion order. Never 404s; an EMPTY ARRAY means the section hides. ' +
        'EXTERNAL cards link off-site (`external: true`); INTERNAL cards are ' +
        'rendered from the live entity and link same-tab via a site-relative path.',
    }),
    ApiResponse({
      status: 200,
      description: 'Featured recommendations retrieved successfully',
      type: [PublicRecommendationResponseDto],
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

export function ApiGetRecommendationSettingsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get the per-surface card caps (admin)',
    }),
    ApiResponse({
      status: 200,
      description: 'Settings retrieved successfully',
      type: RecommendationSettingsResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateRecommendationSettingsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update the per-surface card caps (admin)',
      description:
        'How many recommendation cards the thank-you page and the confirmation ' +
        'email each show (1-10). Takes effect on the next cache bust.',
    }),
    ApiResponse({
      status: 200,
      description: 'Settings updated successfully',
      type: RecommendationSettingsResponseDto,
    }),
    ...adminErrors,
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
