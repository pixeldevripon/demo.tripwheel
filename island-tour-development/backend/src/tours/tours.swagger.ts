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
import { Locale, PricingModel, TourStatus } from '@prisma/client';
import {
  PaginatedToursResponseDto,
  TourDetailResponseDto,
  TourPublicDetailResponseDto,
  TourResponseDto,
  TourSort,
  TourUpdateResponseDto,
} from './dto/tour.dto';

// ── Shared error sets ─────────────────────────────────────────────────────────

const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });

const publicErrors = [serverError];

const commonErrors = [
  ApiResponse({ status: 400, description: 'Bad Request', type: BadRequestErrorDto }),
  ApiResponse({ status: 401, description: 'Unauthorized', type: UnauthorizedErrorDto }),
  serverError,
];

const operatorErrors = [
  ...commonErrors,
  ApiResponse({ status: 403, description: 'Forbidden', type: ForbiddenErrorDto }),
];

const tourIdParam = ApiParam({ name: 'id', description: 'Tour UUID' });

// ── Public slug-based detail ──────────────────────────────────────────────────

export function ApiGetTourBySlugDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a live tour by slug (public - used by the tour detail page)',
      description: [
        'Resolves a tour from the URL slug segments. Handles both URL patterns:',
        '- Destination-only: `?destinationSlug=curacao&slug=sunset-cruise`',
        '- Hub-anchored: `?destinationSlug=curacao&hubSlug=mambo-beach&slug=sunset-cruise`',
        '',
        'Returns the full tour with translation (locale → EN fallback), all images,',
        'inclusions, age bands, active add-ons, languages, and upcoming',
        'AVAILABLE schedules (next 30). Only LIVE + isActive tours are returned.',
      ].join('\n'),
    }),
    ApiParam({ name: 'slug', example: 'sunset-catamaran-cruise', description: 'Tour slug from the URL' }),
    ApiQuery({ name: 'destinationSlug', required: true, example: 'curacao' }),
    ApiQuery({ name: 'hubSlug', required: false, example: 'mambo-beach', description: 'Required for hub-anchored tour URLs' }),
    ApiQuery({ name: 'locale', required: false, enum: Locale, description: 'Content locale - falls back to EN' }),
    ApiResponse({ status: 200, type: TourPublicDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

// ── Public list ───────────────────────────────────────────────────────────────

export function ApiGetAllToursDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all live tours with filters, attribute facets & sorting (public)',
      description:
        'Live tour listing (V2 §7). Beyond the typed params below, you may pass **any filterable attribute key ' +
        'from the dictionary as a query param** - e.g. `?boat_type=catamaran,yacht&booking_type=private&free_cancellation=true`. ' +
        'Comma-separated values are OR-ed within a key; multiple attribute keys are AND-ed. ' +
        'These keys are **dynamic / data-driven**, so they are not enumerated as fixed fields here - the authoritative ' +
        'set of keys (and their allowed values) for a given page comes from `GET /filters/{dest}/{category}` ' +
        'or `GET /attributes?category={slug}`. A few common ones are shown below as examples. Unknown keys are ignored.',
    }),
    // Typed params
    ApiQuery({ name: 'destinationId', required: false, type: String }),
    ApiQuery({ name: 'categoryId', required: false, type: String }),
    ApiQuery({ name: 'hubId', required: false, type: String }),
    ApiQuery({ name: 'pricingModel', required: false, enum: PricingModel }),
    ApiQuery({ name: 'search', required: false, type: String }),
    ApiQuery({ name: 'minPrice', required: false, type: Number }),
    ApiQuery({ name: 'maxPrice', required: false, type: Number }),
    ApiQuery({ name: 'durationMin', required: false, type: Number, description: 'Min duration (minutes)' }),
    ApiQuery({ name: 'durationMax', required: false, type: Number, description: 'Max duration (minutes)' }),
    ApiQuery({ name: 'ratingMin', required: false, type: Number, description: 'Minimum average rating (0–5)' }),
    ApiQuery({ name: 'sort', required: false, enum: TourSort, description: 'Default: recommended' }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    // Example dynamic attribute filters (representative - full list is dictionary-driven)
    ApiQuery({ name: 'booking_type', required: false, type: String, example: 'private', description: 'Example attribute filter (global). See GET /attributes.' }),
    ApiQuery({ name: 'free_cancellation', required: false, type: String, example: 'true', description: 'Example attribute filter (global).' }),
    ApiQuery({ name: 'boat_type', required: false, type: String, example: 'catamaran,yacht', description: 'Example category-specific attribute filter (boat-tours). Comma = OR.' }),
    ApiResponse({ status: 200, type: PaginatedToursResponseDto }),
    ...publicErrors,
  );
}

// ── Operator "my tours" ───────────────────────────────────────────────────────

export function ApiGetMyToursDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all tours for the authenticated operator (all statuses)' }),
    ApiQuery({ name: 'status', required: false, enum: TourStatus }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiResponse({ status: 200, type: PaginatedToursResponseDto }),
    ...commonErrors,
  );
}

// ── Single tour ───────────────────────────────────────────────────────────────

export function ApiGetTourByIdDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a single tour by ID',
      description: 'LIVE tours are public. DRAFT/PAUSED tours require the owner operator or admin.',
    }),
    tourIdParam,
    ApiResponse({ status: 200, type: TourDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

// ── Create ────────────────────────────────────────────────────────────────────

export function ApiCreateTourDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new tour (DRAFT)',
      description:
        'Creates a tour in DRAFT status. For destination-only tours (no hubId) a slug_registry row is written atomically. Hub-anchored tours skip slug_registry.',
    }),
    ApiResponse({ status: 201, type: TourResponseDto }),
    ApiResponse({ status: 409, description: 'Slug already exists in this destination', type: ConflictErrorDto }),
    ...operatorErrors,
  );
}

// ── Update ────────────────────────────────────────────────────────────────────

export function ApiUpdateTourDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update tour core fields',
      description:
        'Slug, destinationId, categoryId and hubId cannot be changed after creation. Returns warnings array (empty in Phase 4; Phase 5 adds category-change guard).',
    }),
    tourIdParam,
    ApiResponse({ status: 200, type: TourUpdateResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function ApiPublishTourDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Publish a draft tour (DRAFT → LIVE)',
      description:
        'All publish blocks must pass: ≥5 images, hero image set, EN overview present, a price, ≥1 category with one primary. All failing blocks are returned together.',
    }),
    tourIdParam,
    ApiResponse({ status: 200, type: TourResponseDto }),
    ApiResponse({
      status: 400,
      description: 'One or more publish blocks not met (images, hero, overview, price, category)',
      type: BadRequestErrorDto,
    }),
    ...operatorErrors,
  );
}

export function ApiPauseTourDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Pause a live tour (LIVE → PAUSED)' }),
    tourIdParam,
    ApiResponse({ status: 200, type: TourResponseDto }),
    ApiResponse({ status: 400, description: 'Tour is not LIVE', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

export function ApiUnpauseTourDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Unpause a tour (PAUSED → LIVE)' }),
    tourIdParam,
    ApiResponse({ status: 200, type: TourResponseDto }),
    ApiResponse({ status: 400, description: 'Tour is not PAUSED', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

export function ApiArchiveTourDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Archive a tour (any status → ARCHIVED)',
      description:
        'Moves the tour to ARCHIVED status. Works for DRAFT, LIVE, and PAUSED tours. Archived tours can be restored to DRAFT or permanently deleted.',
    }),
    tourIdParam,
    ApiResponse({ status: 200, type: TourResponseDto }),
    ApiResponse({ status: 400, description: 'Tour is already archived', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

export function ApiRestoreTourDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Restore an archived tour (ARCHIVED → DRAFT)',
      description:
        'Restores an ARCHIVED tour back to DRAFT status. The tour can then be edited and re-published.',
    }),
    tourIdParam,
    ApiResponse({ status: 200, type: TourResponseDto }),
    ApiResponse({ status: 400, description: 'Tour is not in ARCHIVED status', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteTourDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Permanently delete a tour',
      description:
        'Hard delete. Operators can only permanently delete their own ARCHIVED tours. Admins can force-delete any tour regardless of status.',
    }),
    tourIdParam,
    ApiResponse({ status: 200, description: 'Tour permanently deleted' }),
    ApiResponse({ status: 400, description: 'Tour is not ARCHIVED (operator only)', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

// ── Admin list ────────────────────────────────────────────────────────────────

export function ApiAdminListToursDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all tours across all operators (admin only)' }),
    ApiQuery({ name: 'search', required: false, type: String }),
    ApiQuery({ name: 'status', required: false, enum: TourStatus }),
    ApiQuery({ name: 'operatorId', required: false, type: String }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiResponse({ status: 200, type: PaginatedToursResponseDto }),
    ...operatorErrors,
  );
}
