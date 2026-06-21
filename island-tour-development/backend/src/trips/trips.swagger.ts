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
  PaginatedTripsResponseDto,
  TripDetailResponseDto,
  TripPublicDetailResponseDto,
  TripResponseDto,
  TripSort,
  TripUpdateResponseDto,
} from './dto/trip.dto';

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

const tripIdParam = ApiParam({ name: 'id', description: 'Trip UUID' });

// ── Public slug-based detail ──────────────────────────────────────────────────

export function ApiGetTripBySlugDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a live trip by slug (public — used by the tour detail page)',
      description: [
        'Resolves a trip from the URL slug segments. Handles both URL patterns:',
        '- Destination-only: `?destinationSlug=curacao&slug=sunset-cruise`',
        '- Hub-anchored: `?destinationSlug=curacao&hubSlug=mambo-beach&slug=sunset-cruise`',
        '',
        'Returns the full trip with translation (locale → EN fallback), all images,',
        'highlights, inclusions, age bands, active add-ons, languages, and upcoming',
        'AVAILABLE schedules (next 30). Only LIVE + isActive trips are returned.',
      ].join('\n'),
    }),
    ApiParam({ name: 'slug', example: 'sunset-catamaran-cruise', description: 'Tour slug from the URL' }),
    ApiQuery({ name: 'destinationSlug', required: true, example: 'curacao' }),
    ApiQuery({ name: 'hubSlug', required: false, example: 'mambo-beach', description: 'Required for hub-anchored tour URLs' }),
    ApiQuery({ name: 'locale', required: false, enum: Locale, description: 'Content locale — falls back to EN' }),
    ApiResponse({ status: 200, type: TripPublicDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

// ── Public list ───────────────────────────────────────────────────────────────

export function ApiGetAllTripsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List all live trips with filters, attribute facets & sorting (public)',
      description:
        'Live tour listing (V2 §7). Beyond the typed params below, you may pass **any filterable attribute key ' +
        'from the dictionary as a query param** — e.g. `?boat_type=catamaran,yacht&booking_type=private&free_cancellation=true`. ' +
        'Comma-separated values are OR-ed within a key; multiple attribute keys are AND-ed. ' +
        'These keys are **dynamic / data-driven**, so they are not enumerated as fixed fields here — the authoritative ' +
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
    ApiQuery({ name: 'sort', required: false, enum: TripSort, description: 'Default: recommended' }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    // Example dynamic attribute filters (representative — full list is dictionary-driven)
    ApiQuery({ name: 'booking_type', required: false, type: String, example: 'private', description: 'Example attribute filter (global). See GET /attributes.' }),
    ApiQuery({ name: 'free_cancellation', required: false, type: String, example: 'true', description: 'Example attribute filter (global).' }),
    ApiQuery({ name: 'boat_type', required: false, type: String, example: 'catamaran,yacht', description: 'Example category-specific attribute filter (boat-tours). Comma = OR.' }),
    ApiResponse({ status: 200, type: PaginatedTripsResponseDto }),
    ...publicErrors,
  );
}

// ── Operator "my trips" ───────────────────────────────────────────────────────

export function ApiGetMyTripsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all trips for the authenticated operator (all statuses)' }),
    ApiQuery({ name: 'status', required: false, enum: TourStatus }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiResponse({ status: 200, type: PaginatedTripsResponseDto }),
    ...commonErrors,
  );
}

// ── Single trip ───────────────────────────────────────────────────────────────

export function ApiGetTripByIdDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get a single trip by ID',
      description: 'LIVE trips are public. DRAFT/PAUSED trips require the owner operator or admin.',
    }),
    tripIdParam,
    ApiResponse({ status: 200, type: TripDetailResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...publicErrors,
  );
}

// ── Create ────────────────────────────────────────────────────────────────────

export function ApiCreateTripDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a new trip (DRAFT)',
      description:
        'Creates a trip in DRAFT status. For destination-only trips (no hubId) a slug_registry row is written atomically. Hub-anchored trips skip slug_registry.',
    }),
    ApiResponse({ status: 201, type: TripResponseDto }),
    ApiResponse({ status: 409, description: 'Slug already exists in this destination', type: ConflictErrorDto }),
    ...operatorErrors,
  );
}

// ── Update ────────────────────────────────────────────────────────────────────

export function ApiUpdateTripDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update trip core fields',
      description:
        'Slug, destinationId, categoryId and hubId cannot be changed after creation. Returns warnings array (empty in Phase 4; Phase 5 adds category-change guard).',
    }),
    tripIdParam,
    ApiResponse({ status: 200, type: TripUpdateResponseDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

export function ApiPublishTripDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Publish a draft trip (DRAFT → LIVE)',
      description:
        'All four publish blocks must pass: ≥5 images, hero image set, EN overview present, ≥3 highlights. All failing blocks are returned together.',
    }),
    tripIdParam,
    ApiResponse({ status: 200, type: TripResponseDto }),
    ApiResponse({
      status: 400,
      description: 'One or more publish blocks not met (images, hero, overview, highlights)',
      type: BadRequestErrorDto,
    }),
    ...operatorErrors,
  );
}

export function ApiPauseTripDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Pause a live trip (LIVE → PAUSED)' }),
    tripIdParam,
    ApiResponse({ status: 200, type: TripResponseDto }),
    ApiResponse({ status: 400, description: 'Trip is not LIVE', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

export function ApiUnpauseTripDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Unpause a trip (PAUSED → LIVE)' }),
    tripIdParam,
    ApiResponse({ status: 200, type: TripResponseDto }),
    ApiResponse({ status: 400, description: 'Trip is not PAUSED', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

export function ApiArchiveTripDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Archive a trip (any status → ARCHIVED)',
      description:
        'Moves the trip to ARCHIVED status. Works for DRAFT, LIVE, and PAUSED trips. Archived trips can be restored to DRAFT or permanently deleted.',
    }),
    tripIdParam,
    ApiResponse({ status: 200, type: TripResponseDto }),
    ApiResponse({ status: 400, description: 'Trip is already archived', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

export function ApiRestoreTripDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Restore an archived trip (ARCHIVED → DRAFT)',
      description:
        'Restores an ARCHIVED trip back to DRAFT status. The trip can then be edited and re-published.',
    }),
    tripIdParam,
    ApiResponse({ status: 200, type: TripResponseDto }),
    ApiResponse({ status: 400, description: 'Trip is not in ARCHIVED status', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteTripDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Permanently delete a trip',
      description:
        'Hard delete. Operators can only permanently delete their own ARCHIVED trips. Admins can force-delete any trip regardless of status.',
    }),
    tripIdParam,
    ApiResponse({ status: 200, description: 'Trip permanently deleted' }),
    ApiResponse({ status: 400, description: 'Trip is not ARCHIVED (operator only)', type: BadRequestErrorDto }),
    ApiResponse({ status: 404, type: NotFoundErrorDto }),
    ...operatorErrors,
  );
}

// ── Admin list ────────────────────────────────────────────────────────────────

export function ApiAdminListTripsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all trips across all operators (admin only)' }),
    ApiQuery({ name: 'search', required: false, type: String }),
    ApiQuery({ name: 'status', required: false, enum: TourStatus }),
    ApiQuery({ name: 'operatorId', required: false, type: String }),
    ApiQuery({ name: 'page', required: false, type: Number, example: 1 }),
    ApiQuery({ name: 'limit', required: false, type: Number, example: 20 }),
    ApiResponse({ status: 200, type: PaginatedTripsResponseDto }),
    ...operatorErrors,
  );
}
