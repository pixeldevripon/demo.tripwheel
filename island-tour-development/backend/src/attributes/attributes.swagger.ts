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
  AttributeDefinitionResponseDto,
  DeleteMessageResponseDto,
  FiltersResponseDto,
  TourAttributeResponseDto,
} from './dto/attribute.dto';

const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });
const publicErrors = [serverError];
const commonErrors = [
  ApiResponse({ status: 400, type: BadRequestErrorDto }),
  ApiResponse({ status: 401, type: UnauthorizedErrorDto }),
  serverError,
];
const adminErrors = [...commonErrors, ApiResponse({ status: 403, type: ForbiddenErrorDto })];

// ── Dictionary ────────────────────────────────────────────────────────────────

export function ApiGetAttributeDefinitionsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List attribute definitions (public)',
      description:
        'The central attribute dictionary (V2 §7). Filter by `category` (slug) to get that category-specific ' +
        'set plus global attributes, `globalOnly`, or `filterableOnly`. Ordered by sortOrder.',
    }),
    ApiQuery({ name: 'category', required: false, example: 'boat-tours' }),
    ApiQuery({ name: 'globalOnly', required: false, type: Boolean }),
    ApiQuery({ name: 'filterableOnly', required: false, type: Boolean }),
    ApiResponse({ status: 200, type: [AttributeDefinitionResponseDto] }),
    ...publicErrors,
  );
}

export function ApiGetAttributeDefinitionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get one attribute definition by key (public)' }),
    ApiParam({ name: 'key', example: 'boat_type' }),
    ApiResponse({ status: 200, type: AttributeDefinitionResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

export function ApiCreateAttributeDefinitionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create an attribute definition (Admin)',
      description: 'allowedValues is required for ENUM / ENUM_MULTI. `appliesToCategories` holds category slugs ([] = global).',
    }),
    ApiResponse({ status: 201, type: AttributeDefinitionResponseDto }),
    ApiResponse({ status: 409, description: 'Key already exists', type: ConflictErrorDto }),
    ...adminErrors,
  );
}

export function ApiUpdateAttributeDefinitionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an attribute definition (Admin). Key is immutable.' }),
    ApiParam({ name: 'key', example: 'boat_type' }),
    ApiResponse({ status: 200, type: AttributeDefinitionResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteAttributeDefinitionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Deactivate an attribute definition (Admin)', description: 'Soft — existing tour values are preserved.' }),
    ApiParam({ name: 'key', example: 'boat_type' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}

// ── Filters (category page) ─────────────────────────────────────────────────

export function ApiGetFiltersDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Available filters for a destination + category page (public)',
      description:
        'V2 §7: filterable attributes applicable to the (destination, category), each with the values ' +
        'present in the current published-tour set + counts, plus price/duration ranges. Powers the filter sidebar.',
    }),
    ApiParam({ name: 'destinationSlug', example: 'curacao' }),
    ApiParam({ name: 'categorySlug', example: 'boat-tours' }),
    ApiResponse({ status: 200, type: FiltersResponseDto }),
    ApiResponse({ status: 404, description: 'Destination/category not found', type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

// ── Per-tour assignment ─────────────────────────────────────────────────────

export function ApiGetTourAttributesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List a tour’s attribute values (Operator/Admin)' }),
    ApiParam({ name: 'tripId', description: 'Trip UUID' }),
    ApiResponse({ status: 200, type: [TourAttributeResponseDto] }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...commonErrors,
  );
}

export function ApiSetTourAttributesDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Upsert a tour’s attribute values (Operator owner / Admin)',
      description:
        'Each key must exist in the dictionary; each value is validated against its dataType + allowedValues ' +
        '(ENUM_MULTI accepts a comma-separated list). Unknown keys / invalid values are rejected.',
    }),
    ApiParam({ name: 'tripId', description: 'Trip UUID' }),
    ApiResponse({ status: 200, type: [TourAttributeResponseDto] }),
    ApiResponse({ status: 400, description: 'Unknown key or invalid value', type: BadRequestErrorDto }),
    ...adminErrors,
  );
}

export function ApiDeleteTourAttributeDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove one attribute from a tour (Operator owner / Admin)' }),
    ApiParam({ name: 'tripId', description: 'Trip UUID' }),
    ApiParam({ name: 'key', example: 'boat_type' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...adminErrors,
  );
}
