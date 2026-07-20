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
  FeaturedExperienceResponseDto,
  ResolvedExperienceResponseDto,
} from './dto/featured-experience.dto';

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

export function ApiGetPublicExperiencesDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resolved "Top Island Experiences" cards (no auth)',
      description:
        'Rows that fail to resolve are dropped, so a card can never be a dead ' +
        "link. Category gate mirrors that page's exact 404 condition " +
        '(destination + category active, at least one live tour). Hub gate ' +
        '(active, PUBLISHED, at least one live tour) is deliberately stricter ' +
        'than the hub page, which renders with zero tours - a "top experience" ' +
        'with nothing bookable is a dead end even at 200. A category row with ' +
        'no pinned destination resolves to the destination where that category ' +
        'has the most live tours.',
    }),
    ApiResponse({
      status: 200,
      description: 'Cards resolved successfully',
      type: [ResolvedExperienceResponseDto],
    }),
    ...commonErrors,
  );
}

export function ApiListFeaturedExperiencesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List curated featured experiences (admin)' }),
    ApiResponse({
      status: 200,
      description: 'Featured experiences retrieved successfully',
      type: [FeaturedExperienceResponseDto],
    }),
    ...adminErrors,
  );
}

export function ApiCreateFeaturedExperienceDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Feature a category or hub (admin)',
      description:
        'Tours can never be featured (master: categories and hubs only). ' +
        '`entityId` has no foreign key, so its existence is validated here.',
    }),
    ApiResponse({
      status: 201,
      description: 'Featured experience created successfully',
      type: FeaturedExperienceResponseDto,
    }),
    ApiResponse({
      status: 409,
      description: 'This entity is already featured at that scope',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateFeaturedExperienceDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a featured experience (admin)' }),
    ApiResponse({
      status: 200,
      description: 'Featured experience updated successfully',
      type: FeaturedExperienceResponseDto,
    }),
    ApiResponse({
      status: 404,
      description: 'Featured experience not found',
      type: NotFoundErrorDto,
    }),
    ApiResponse({
      status: 409,
      description: 'This entity is already featured at that scope',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiDeleteFeaturedExperienceDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a featured experience (admin)' }),
    ApiResponse({
      status: 200,
      description: 'Featured experience removed successfully',
    }),
    ApiResponse({
      status: 404,
      description: 'Featured experience not found',
      type: NotFoundErrorDto,
    }),
    ...adminErrors,
  );
}
