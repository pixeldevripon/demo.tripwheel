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
  TourTranslationResponseDto,
} from './dto/tour-children.dto';

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

const tourIdParam = ApiParam({ name: 'tourId', description: 'Tour UUID' });

// ── Images ────────────────────────────────────────────────────────────────────

export function ApiGetImagesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List all images for a tour' }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourImageResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddImageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add an image to a tour',
      description: 'If isHero=true, clears existing hero and sets this image as hero in a transaction.',
    }),
    tourIdParam,
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
    tourIdParam,
    ApiParam({ name: 'imageId', description: 'Image UUID' }),
    ApiResponse({ status: 200, type: TourImageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveImageDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an image from a tour' }),
    tourIdParam,
    ApiParam({ name: 'imageId', description: 'Image UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Add-Ons ───────────────────────────────────────────────────────────────────

export function ApiGetAddOnsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List add-ons for a tour' }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourAddOnResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddAddOnDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add an add-on to a tour' }),
    tourIdParam,
    ApiResponse({ status: 201, type: TourAddOnResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateAddOnDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an add-on' }),
    tourIdParam,
    ApiParam({ name: 'addonId', description: 'Add-on UUID' }),
    ApiResponse({ status: 200, type: TourAddOnResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveAddOnDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an add-on from a tour' }),
    tourIdParam,
    ApiParam({ name: 'addonId', description: 'Add-on UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Age Bands ───────────────────────────────────────────────────────────────────

export function ApiGetAgeBandsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List age bands (flat per-traveler pricing) for a tour' }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourAgeBandResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddAgeBandDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add an age band to a tour',
      description:
        'Setting isDefault=true clears the previous default band atomically. Recomputes the tour priceFrom from the cheapest band.',
    }),
    tourIdParam,
    ApiResponse({ status: 201, type: TourAgeBandResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateAgeBandDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update an age band',
      description:
        'Setting isDefault=true clears the previous default band atomically. Recomputes the tour priceFrom from the cheapest band.',
    }),
    tourIdParam,
    ApiParam({ name: 'ageBandId', description: 'Age band UUID' }),
    ApiResponse({ status: 200, type: TourAgeBandResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveAgeBandDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Remove an age band from a tour',
      description: 'Returns 409 if the band is referenced by existing bookings.',
    }),
    tourIdParam,
    ApiParam({ name: 'ageBandId', description: 'Age band UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Languages ─────────────────────────────────────────────────────────────────

export function ApiGetLanguagesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List languages for a tour' }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourLanguageResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddLanguageDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add a language to a tour (ISO 639-1 code)' }),
    tourIdParam,
    ApiResponse({ status: 201, type: TourLanguageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveLanguageDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a language from a tour' }),
    tourIdParam,
    ApiParam({ name: 'languageId', description: 'Language UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Highlights ────────────────────────────────────────────────────────────────

export function ApiGetHighlightsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List highlights for a tour (all translations)' }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourHighlightResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddHighlightDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add a highlight to a tour (creates EN translation atomically)' }),
    tourIdParam,
    ApiResponse({ status: 201, type: TourHighlightResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateHighlightDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a highlight display order' }),
    tourIdParam,
    ApiParam({ name: 'highlightId', description: 'Highlight UUID' }),
    ApiResponse({ status: 200, type: TourHighlightResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveHighlightDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a highlight and all its translations' }),
    tourIdParam,
    ApiParam({ name: 'highlightId', description: 'Highlight UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertHighlightTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Upsert a highlight translation for a locale' }),
    tourIdParam,
    ApiParam({ name: 'highlightId', description: 'Highlight UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: TourHighlightTranslationDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteHighlightTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete a highlight translation (non-EN locales only)' }),
    tourIdParam,
    ApiParam({ name: 'highlightId', description: 'Highlight UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Inclusions ────────────────────────────────────────────────────────────────

export function ApiGetInclusionsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List inclusions for a tour (all translations)' }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourInclusionResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddInclusionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Add an inclusion to a tour (creates EN translation atomically)' }),
    tourIdParam,
    ApiResponse({ status: 201, type: TourInclusionResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateInclusionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update an inclusion icon or display order' }),
    tourIdParam,
    ApiParam({ name: 'inclusionId', description: 'Inclusion UUID' }),
    ApiResponse({ status: 200, type: TourInclusionResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveInclusionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an inclusion and all its translations' }),
    tourIdParam,
    ApiParam({ name: 'inclusionId', description: 'Inclusion UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertInclusionTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Upsert an inclusion translation for a locale' }),
    tourIdParam,
    ApiParam({ name: 'inclusionId', description: 'Inclusion UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: TourInclusionTranslationDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteInclusionTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete an inclusion translation (non-EN locales only)' }),
    tourIdParam,
    ApiParam({ name: 'inclusionId', description: 'Inclusion UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Tour Translations ─────────────────────────────────────────────────────────

export function ApiGetAllTourTranslationsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get all translations for a tour' }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourTranslationResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiGetTourTranslationByLocaleDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get tour translation for a specific locale' }),
    tourIdParam,
    ApiParam({ name: 'locale', enum: Locale, example: 'en' }),
    ApiResponse({ status: 200, type: TourTranslationResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertTourTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Upsert tour translation for a locale (title, overview, description)' }),
    tourIdParam,
    ApiParam({ name: 'locale', enum: Locale, example: 'en' }),
    ApiResponse({ status: 200, type: TourTranslationResponseDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteTourTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Delete tour translation for a locale (non-EN only)' }),
    tourIdParam,
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

