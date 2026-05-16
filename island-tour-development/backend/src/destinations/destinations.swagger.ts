import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import {
  DeleteDestinationResponseDto,
  DestinationResponseDto,
  PaginatedDestinationsResponseDto,
} from './dto/destination.dto';

const publicErrors = [
  ApiResponse({ status: 500, type: InternalServerErrorDto }),
];

const adminErrors = [
  ApiResponse({ status: 400, type: BadRequestErrorDto }),
  ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
  ApiResponse({ status: 403, type: ForbiddenErrorDto }),
  ApiResponse({ status: 500, type: InternalServerErrorDto }),
];

export function ApiGetAllDestinationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all destinations (paginated)',
      description: 'Public endpoint. Optionally filter by isActive.',
    }),
    ApiQuery({ name: 'isActive', required: false, type: Boolean }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiResponse({ status: 200, type: PaginatedDestinationsResponseDto }),
    ...publicErrors,
  );
}

export function ApiGetActiveDestinationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all active destinations',
      description: 'Public endpoint. Returns all active destinations without pagination.',
    }),
    ApiResponse({ status: 200, type: [DestinationResponseDto] }),
    ...publicErrors,
  );
}

export function ApiGetDestinationBySlugDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a destination by slug (public)',
      description:
        'Destination slugs are globally unique. Example: GET /destinations/slug/curacao',
    }),
    ApiParam({ name: 'slug', description: 'Destination slug', example: 'curacao' }),
    ApiResponse({ status: 200, type: DestinationResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiGetDestinationByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a destination by UUID' }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({ status: 200, type: DestinationResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiCreateDestinationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new destination (Admin/Editor only)',
      description:
        'Atomically creates the destination, seeds one RESERVED slug_registry row for "tours", ' +
        'and seeds one CATEGORY slug_registry row per existing active category.',
    }),
    ApiResponse({ status: 201, type: DestinationResponseDto }),
    ApiResponse({
      status: 409,
      description: 'Destination slug already exists',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateDestinationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a destination (Admin/Editor only)',
      description: 'Updates display name, hero image, or active status. Slug is immutable.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({ status: 200, type: DestinationResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteDestinationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Deactivate a destination (Admin/Editor only)',
      description:
        'Soft-delete: sets isActive = false. ' +
        'Seeded destinations and those with existing trips are blocked.',
    }),
    ApiParam({ name: 'id', description: 'Destination UUID' }),
    ApiResponse({ status: 200, type: DeleteDestinationResponseDto }),
    ApiResponse({ status: 403, type: ForbiddenErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ApiResponse({ status: 409, type: ConflictErrorDto }),
    ...adminErrors,
  );
}
