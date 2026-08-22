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
  TourExclusionResponseDto,
  TourExclusionTranslationDto,
  TourFeatureResponseDto,
  TourFeatureTranslationDto,
  TourHighlightResponseDto,
  TourHighlightTranslationDto,
  TourImageResponseDto,
  TourInclusionResponseDto,
  TourInclusionTranslationDto,
  TourLanguageResponseDto,
  TourLocationResponseDto,
  TourLocationTranslationDto,
  TourTranslationResponseDto,
  PickupLocationResponseDto,
  PickupLocationTranslationDto,
} from './dto/tour-children.dto';

// ── Shared error sets ─────────────────────────────────────────────────────────

const serverError = ApiResponse({ status: 500, type: InternalServerErrorDto });

const commonErrors = [
  ApiResponse({
    status: 400,
    description: 'Bad Request',
    type: BadRequestErrorDto,
  }),
  ApiResponse({
    status: 401,
    description: 'Unauthorized',
    type: UnauthorizedErrorDto,
  }),
  serverError,
];

const operatorErrors = [
  ...commonErrors,
  ApiResponse({
    status: 403,
    description: 'Forbidden',
    type: ForbiddenErrorDto,
  }),
  ApiResponse({
    status: 404,
    description: 'Not Found',
    type: NotFoundErrorDto,
  }),
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
      description:
        'If isHero=true, clears existing hero and sets this image as hero in a transaction.',
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
      description:
        'Setting isHero=true clears the previous hero image atomically.',
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
    ApiOperation({
      summary: 'List age bands (flat per-traveler pricing) for a tour',
    }),
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
      description:
        'Returns 409 if the band is referenced by existing bookings.',
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
    ApiOperation({
      summary: 'Add a highlight to a tour (creates EN translation atomically)',
    }),
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
    ApiOperation({
      summary: 'Delete a highlight translation (non-EN locales only)',
    }),
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
    ApiOperation({
      summary: 'Add an inclusion to a tour (creates EN translation atomically)',
    }),
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
    ApiOperation({
      summary: 'Delete an inclusion translation (non-EN locales only)',
    }),
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
    ApiOperation({
      summary:
        'Upsert tour translation for a locale (title, overview, description)',
    }),
    tourIdParam,
    ApiParam({ name: 'locale', enum: Locale, example: 'en' }),
    ApiResponse({ status: 200, type: TourTranslationResponseDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteTourTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete tour translation for a locale (non-EN only)',
    }),
    tourIdParam,
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Exclusions ────────────────────────────────────────────────────────────────

export function ApiGetExclusionsDocs() {
  return applyDecorators(
    ApiOperation({ summary: "List a tour's exclusions (what's NOT included)" }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourExclusionResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddExclusionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add an exclusion to a tour (creates EN label atomically)',
    }),
    tourIdParam,
    ApiResponse({ status: 201, type: TourExclusionResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateExclusionDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update an exclusion (icon / type / priceText / order / image)',
    }),
    tourIdParam,
    ApiParam({ name: 'exclusionId', description: 'Exclusion UUID' }),
    ApiResponse({ status: 200, type: TourExclusionResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveExclusionDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove an exclusion and all its translations' }),
    tourIdParam,
    ApiParam({ name: 'exclusionId', description: 'Exclusion UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertExclusionTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Upsert an exclusion label translation for a locale',
    }),
    tourIdParam,
    ApiParam({ name: 'exclusionId', description: 'Exclusion UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: TourExclusionTranslationDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteExclusionTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete an exclusion translation (non-EN locales only)',
    }),
    tourIdParam,
    ApiParam({ name: 'exclusionId', description: 'Exclusion UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Features ──────────────────────────────────────────────────────────────────

export function ApiGetFeaturesDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'List features for a tour (know before you go, safety, important info)',
    }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourFeatureResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddFeatureDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add a feature to a tour (creates EN text atomically)',
    }),
    tourIdParam,
    ApiResponse({ status: 201, type: TourFeatureResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateFeatureDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Update a feature type or display order' }),
    tourIdParam,
    ApiParam({ name: 'featureId', description: 'Feature UUID' }),
    ApiResponse({ status: 200, type: TourFeatureResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveFeatureDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a feature and all its translations' }),
    tourIdParam,
    ApiParam({ name: 'featureId', description: 'Feature UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertFeatureTranslationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Upsert a feature text translation for a locale' }),
    tourIdParam,
    ApiParam({ name: 'featureId', description: 'Feature UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: TourFeatureTranslationDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteFeatureTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a feature translation (non-EN locales only)',
    }),
    tourIdParam,
    ApiParam({ name: 'featureId', description: 'Feature UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Locations ─────────────────────────────────────────────────────────────────

export function ApiGetLocationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'List itinerary / meeting-point locations for a tour (all translations)',
    }),
    tourIdParam,
    ApiResponse({ status: 200, type: [TourLocationResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddLocationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add a location to a tour (creates EN title atomically)',
    }),
    tourIdParam,
    ApiResponse({ status: 201, type: TourLocationResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdateLocationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a location (coordinates, address, type flags, timing)',
    }),
    tourIdParam,
    ApiParam({ name: 'locationId', description: 'Location UUID' }),
    ApiResponse({ status: 200, type: TourLocationResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemoveLocationDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a location and all its translations' }),
    tourIdParam,
    ApiParam({ name: 'locationId', description: 'Location UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertLocationTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Upsert a location title / short-description translation for a locale',
    }),
    tourIdParam,
    ApiParam({ name: 'locationId', description: 'Location UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: TourLocationTranslationDto }),
    ...operatorErrors,
  );
}

export function ApiDeleteLocationTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a location translation (non-EN locales only)',
    }),
    tourIdParam,
    ApiParam({ name: 'locationId', description: 'Location UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

// ── Pickup Locations ──────────────────────────────────────────────────────────

export function ApiGetPickupLocationsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List pickup locations for a tour (all translations)',
    }),
    tourIdParam,
    ApiResponse({ status: 200, type: [PickupLocationResponseDto] }),
    ...operatorErrors,
  );
}

export function ApiAddPickupLocationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add a pickup location to a tour (creates EN title atomically)',
    }),
    tourIdParam,
    ApiResponse({ status: 201, type: PickupLocationResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpdatePickupLocationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Update a pickup location (coordinates, address, pickup window, active flag)',
    }),
    tourIdParam,
    ApiParam({ name: 'pickupLocationId', description: 'Pickup location UUID' }),
    ApiResponse({ status: 200, type: PickupLocationResponseDto }),
    ...operatorErrors,
  );
}

export function ApiRemovePickupLocationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Remove a pickup location and all its translations',
    }),
    tourIdParam,
    ApiParam({ name: 'pickupLocationId', description: 'Pickup location UUID' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}

export function ApiUpsertPickupLocationTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary:
        'Upsert a pickup location title / directions translation for a locale',
    }),
    tourIdParam,
    ApiParam({ name: 'pickupLocationId', description: 'Pickup location UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: PickupLocationTranslationDto }),
    ...operatorErrors,
  );
}

export function ApiDeletePickupLocationTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a pickup location translation (non-EN locales only)',
    }),
    tourIdParam,
    ApiParam({ name: 'pickupLocationId', description: 'Pickup location UUID' }),
    ApiParam({ name: 'locale', enum: Locale, example: 'nl' }),
    ApiResponse({ status: 200, type: DeleteMessageResponseDto }),
    ...operatorErrors,
  );
}
