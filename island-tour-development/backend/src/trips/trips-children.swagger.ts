import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { Locale } from '@prisma/client';
import {
  DeleteMessageResponseDto,
  TourAddOnResponseDto,
  TourAgeBandResponseDto,
  TourHighlightResponseDto,
  TourHighlightTranslationDto,
  TourImageResponseDto,
  TourInclusionResponseDto,
  TourInclusionTranslationDto,
  TourLanguageResponseDto,
  TourScheduleResponseDto,
  TripTranslationResponseDto,
} from './dto/trip-children.dto';

// ── Shared error sets ─────────────────────────────────────────────────────────

const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });

const commonErrors = [
  ApiResponse({ status: 400, description: 'Bad Request', type: BadRequestErrorDto }),
  ApiResponse({ status: 401, description: 'Unauthorized', type: UnauthorizedErrorDto }),
  serverError,
];

const operatorErrors = [
  ...commonErrors,
  ApiResponse({ status: 403, description: 'Forbidden', type: ForbiddenErrorDto }),
  ApiResponse({ status: 404, description: 'Not Found', type: NotFoundErrorDto }),
];

const tripIdParam = ApiParam({ name: 'tripId', description: 'Trip UUID' });

// ── Images ────────────────────────────────────────────────────────────────────

export function ApiGetImagesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all images for a trip' }),
    tripIdParam,
    ApiResponse({ status: 200, type: [TourImageResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddImageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add an image to a trip',
      description: 'If isHero=true, clears existing hero and sets this image as hero in a transaction.',
    }),
    tripIdParam,
    ApiResponse({ status: 201, type: TourImageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateImageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update an image (hero, focal point, alt text, order)',
      description: 'Setting isHero=true clears the previous hero image atomically.',
    }),
    tripIdParam,
    ApiParam({ name: 'imageId', description: 'Image UUID' }),
    ApiResponse({ status: 200, type: TourImageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveImageDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an image from a trip' }),
    tripIdParam,
    ApiParam({ name: 'imageId', description: 'Image UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Age Bands ─────────────────────────────────────────────────────────────────

export function ApiGetAgeBandsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List age bands for a trip' }),
    tripIdParam,
    ApiResponse({ status: 200, type: [TourAgeBandResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddAgeBandDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add an age band to a trip' }),
    tripIdParam,
    ApiResponse({ status: 201, type: TourAgeBandResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateAgeBandDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an age band' }),
    tripIdParam,
    ApiParam({ name: 'bandId', description: 'Age band UUID' }),
    ApiResponse({ status: 200, type: TourAgeBandResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveAgeBandDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an age band from a trip' }),
    tripIdParam,
    ApiParam({ name: 'bandId', description: 'Age band UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Add-Ons ───────────────────────────────────────────────────────────────────

export function ApiGetAddOnsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List add-ons for a trip' }),
    tripIdParam,
    ApiResponse({ status: 200, type: [TourAddOnResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddAddOnDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add an add-on to a trip' }),
    tripIdParam,
    ApiResponse({ status: 201, type: TourAddOnResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateAddOnDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an add-on' }),
    tripIdParam,
    ApiParam({ name: 'addonId', description: 'Add-on UUID' }),
    ApiResponse({ status: 200, type: TourAddOnResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveAddOnDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an add-on from a trip' }),
    tripIdParam,
    ApiParam({ name: 'addonId', description: 'Add-on UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Languages ─────────────────────────────────────────────────────────────────

export function ApiGetLanguagesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List languages for a trip' }),
    tripIdParam,
    ApiResponse({ status: 200, type: [TourLanguageResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddLanguageDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add a language to a trip (ISO 639-1 code)' }),
    tripIdParam,
    ApiResponse({ status: 201, type: TourLanguageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveLanguageDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a language from a trip' }),
    tripIdParam,
    ApiParam({ name: 'languageId', description: 'Language UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Highlights ────────────────────────────────────────────────────────────────

export function ApiGetHighlightsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List highlights for a trip (all translations)' }),
    tripIdParam,
    ApiResponse({ status: 200, type: [TourHighlightResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddHighlightDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add a highlight to a trip (creates EN translation atomically)' }),
    tripIdParam,
    ApiResponse({ status: 201, type: TourHighlightResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateHighlightDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a highlight display order' }),
    tripIdParam,
    ApiParam({ name: 'highlightId', description: 'Highlight UUID' }),
    ApiResponse({ status: 200, type: TourHighlightResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveHighlightDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a highlight and all its translations' }),
    tripIdParam,
    ApiParam({ name: 'highlightId', description: 'Highlight UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertHighlightTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Upsert a highlight translation for a locale' }),
    tripIdParam,
    ApiParam({ name: 'highlightId', description: 'Highlight UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: TourHighlightTranslationDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteHighlightTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a highlight translation (non-EN locales only)' }),
    tripIdParam,
    ApiParam({ name: 'highlightId', description: 'Highlight UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Inclusions ────────────────────────────────────────────────────────────────

export function ApiGetInclusionsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List inclusions for a trip (all translations)' }),
    tripIdParam,
    ApiResponse({ status: 200, type: [TourInclusionResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddInclusionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add an inclusion to a trip (creates EN translation atomically)' }),
    tripIdParam,
    ApiResponse({ status: 201, type: TourInclusionResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateInclusionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an inclusion icon or display order' }),
    tripIdParam,
    ApiParam({ name: 'inclusionId', description: 'Inclusion UUID' }),
    ApiResponse({ status: 200, type: TourInclusionResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveInclusionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an inclusion and all its translations' }),
    tripIdParam,
    ApiParam({ name: 'inclusionId', description: 'Inclusion UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertInclusionTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Upsert an inclusion translation for a locale' }),
    tripIdParam,
    ApiParam({ name: 'inclusionId', description: 'Inclusion UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: TourInclusionTranslationDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteInclusionTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete an inclusion translation (non-EN locales only)' }),
    tripIdParam,
    ApiParam({ name: 'inclusionId', description: 'Inclusion UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Trip Translations ─────────────────────────────────────────────────────────

export function ApiGetAllTripTranslationsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all translations for a trip' }),
    tripIdParam,
    ApiResponse({ status: 200, type: [TripTranslationResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiGetTripTranslationByLocaleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get trip translation for a specific locale' }),
    tripIdParam,
    ApiParam({ name: 'locale', enum: Locale, example: 'en' }),
    ApiResponse({ status: 200, type: TripTranslationResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertTripTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Upsert trip translation for a locale (title, overview, description)' }),
    tripIdParam,
    ApiParam({ name: 'locale', enum: Locale, example: 'en' }),
    ApiResponse({ status: 200, type: TripTranslationResponseDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteTripTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete trip translation for a locale (non-EN only)' }),
    tripIdParam,
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Schedules ─────────────────────────────────────────────────────────────────

export function ApiGetSchedulesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List schedules for a trip (public)' }),
    tripIdParam,
    ApiResponse({ status: 200, type: [TourScheduleResponseDto] }),
    ApiResponse({ status: 404, description: 'Trip not found', type: NotFoundErrorDto }),
    ApiResponse({ status: 500, type: InternalServerErrorDto }),
  );
}

export function ApiCreateScheduleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add a schedule (departure date/time + capacity) to a trip' }),
    tripIdParam,
    ApiResponse({ status: 201, type: TourScheduleResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateScheduleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update schedule capacity or status' }),
    tripIdParam,
    ApiParam({ name: 'scheduleId', description: 'Schedule UUID' }),
    ApiResponse({ status: 200, type: TourScheduleResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveScheduleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a schedule from a trip' }),
    tripIdParam,
    ApiParam({ name: 'scheduleId', description: 'Schedule UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}
