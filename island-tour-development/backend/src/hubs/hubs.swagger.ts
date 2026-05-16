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
  AddAllowedCategoryResponseDto,
  DeleteHubResponseDto,
  HubDetailResponseDto,
  PaginatedHubsResponseDto,
  RemoveAllowedCategoryResponseDto,
} from './dto/hub.dto';

const publicErrors = [
  ApiResponse({ status: 500, type: InternalServerErrorDto }),
];

const adminErrors = [
  ApiResponse({ status: 400, type: BadRequestErrorDto }),
  ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
  ApiResponse({ status: 403, type: ForbiddenErrorDto }),
  ApiResponse({ status: 500, type: InternalServerErrorDto }),
];

export function ApiGetAllHubsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all hubs (paginated)',
      description: 'Public endpoint. Optionally filter by destinationId and isActive.',
    }),
    ApiQuery({ name: 'destinationId', required: false, type: String }),
    ApiQuery({ name: 'isActive', required: false, type: Boolean }),
    ApiQuery({ name: 'page', required: false, type: Number }),
    ApiQuery({ name: 'limit', required: false, type: Number }),
    ApiResponse({ status: 200, type: PaginatedHubsResponseDto }),
    ...publicErrors,
  );
}

export function ApiGetActiveHubsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all active hubs',
      description: 'Public endpoint. Returns all active hubs without pagination. Optionally filter by destinationId.',
    }),
    ApiQuery({ name: 'destinationId', required: false, type: String }),
    ApiResponse({ status: 200, type: [HubDetailResponseDto] }),
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
    ApiResponse({ status: 200, type: HubDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiGetHubByIdDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a hub by UUID' }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: HubDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiCreateHubDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new hub (Admin/Editor only)',
      description:
        'Atomically creates the hub and seeds one slug_registry row for its destination. ' +
        'Optionally seeds allowed categories in the same transaction.',
    }),
    ApiResponse({ status: 201, type: HubDetailResponseDto }),
    ApiResponse({ status: 404, description: 'Destination not found', type: NotFoundErrorDto }),
    ApiResponse({ status: 409, description: 'Hub slug already exists for this destination', type: ConflictErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateHubDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a hub (Admin/Editor only)',
      description:
        'Updates display name, description, or active status. Slug is immutable. ' +
        'If isActive changes, the slug_registry row is mirrored in the same transaction.',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiResponse({ status: 200, type: HubDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteHubDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Deactivate a hub (Admin/Editor only)',
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

export function ApiAddAllowedCategoryDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add an allowed category to a hub (Admin/Editor only)',
      description: 'Adds a category to the hub\'s allowed set. Operators can only assign this category to trips in this hub.',
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
    ApiOperation({
      summary: 'Remove an allowed category from a hub (Admin/Editor only)',
    }),
    ApiParam({ name: 'id', description: 'Hub UUID' }),
    ApiParam({ name: 'categoryId', description: 'Category UUID' }),
    ApiResponse({ status: 200, type: RemoveAllowedCategoryResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}
