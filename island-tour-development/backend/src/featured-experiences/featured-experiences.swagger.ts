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
      summary: '"Top Island Experiences" cards (no auth)',
      description:
        'Presentation-only cards: an admin-typed label + poster + optional ' +
        'video, in display order. Cards reference no category or hub and ' +
        'carry no link. The only gate is "has a poster" - a card without one ' +
        'is dropped (the slide is a full-bleed image with the title over it). ' +
        'The `locale`/`destination` query params are accepted for backward ' +
        'compatibility and ignored: the label is a single admin-entered ' +
        'string, identical in every locale.',
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
    ApiOperation({ summary: 'List curated featured cards (admin)' }),
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
      summary: 'Add a featured card (admin)',
      description:
        'A standalone presentation card: label + poster + optional video. ' +
        'No entity reference, no link - the reel is a mood board, not ' +
        'navigation.',
    }),
    ApiResponse({
      status: 201,
      description: 'Featured experience created successfully',
      type: FeaturedExperienceResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateFeaturedExperienceDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a featured card (admin)' }),
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
    ...adminErrors,
  );
}

export function ApiDeleteFeaturedExperienceDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a featured card (admin)' }),
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
