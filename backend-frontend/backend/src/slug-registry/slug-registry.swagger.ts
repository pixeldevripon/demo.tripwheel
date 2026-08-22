import {
  NotFoundErrorDto,
  BadRequestErrorDto,
  InternalServerErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { SlugResolveResponseDto } from './dto/slug-registry.dto';

export function ApiResolveSlugDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resolve a slug to an entity type and ID',
      description:
        'Given a (destinationSlug, slug) pair, returns the entity type and ID. ' +
        'Used by the frontend to determine which page component to render for a dynamic URL segment. ' +
        'Returns 404 if the slug does not exist or is inactive.',
    }),
    ApiQuery({ name: 'destinationSlug', required: true, example: 'curacao' }),
    ApiQuery({ name: 'slug', required: true, example: 'boat-tours' }),
    ApiResponse({ status: 200, type: SlugResolveResponseDto }),
    ApiResponse({ status: 400, type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({ status: 500, type: InternalServerErrorDto }),
  );
}
