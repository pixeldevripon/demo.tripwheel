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
  HotelResponseDto,
  HotelTranslationEntryDto,
  PublicHotelResponseDto,
} from './dto/hotel.dto';

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

const notFound = ApiResponse({
  status: 404,
  description: 'Hotel not found',
  type: NotFoundErrorDto,
});

export function ApiGetPublicHotelDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get the promoted hotel for a locale (no auth)',
      description:
        'The thank-you page renders ONE card, so this returns one hotel: the ' +
        'first enabled, complete one by displayOrder. Never 404s. `enabled` is ' +
        'the whole contract - false when no hotel qualifies (all switched off, ' +
        'or each missing an image, English title or booking link), and every ' +
        'other field is null in that case, so the page hides the section rather ' +
        'than rendering a broken card. Copy falls back to English per field; a ' +
        'null eyebrow or CTA label means the site keeps its own translated label.',
    }),
    ApiResponse({
      status: 200,
      description: 'Promoted hotel retrieved successfully',
      type: PublicHotelResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiListHotelsDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List every hotel in promotion order (admin)',
      description:
        'Ordered by displayOrder then id - the same order the public read ' +
        'promotes by. Exactly one row can carry `isPromoted: true`.',
    }),
    ApiResponse({
      status: 200,
      description: 'Hotels retrieved successfully',
      type: [HotelResponseDto],
    }),
    ...adminErrors,
  );
}

export function ApiGetHotelDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get one hotel with every locale (admin)' }),
    ApiResponse({
      status: 200,
      description: 'Hotel retrieved successfully',
      type: HotelResponseDto,
    }),
    ...adminErrors,
    notFound,
  );
}

export function ApiCreateHotelDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a hotel (admin)',
      description:
        'The English copy is written in the same transaction as the row, so a ' +
        'hotel always has a name - which is both the render gate and the label ' +
        'the list shows. A new hotel with no image or booking link is created ' +
        'incomplete and simply is not promoted until those are filled in.',
    }),
    ApiResponse({
      status: 201,
      description: 'Hotel created successfully',
      type: HotelResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateHotelDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update the locale-agnostic hotel fields (admin)',
      description:
        'Only the named fields are touched; an explicit null clears one. ' +
        'Clearing the image or the booking link takes this hotel out of the ' +
        'running, which is reported back as `isPromoted: false` - and the card ' +
        'passes to the next enabled, complete hotel.',
    }),
    ApiResponse({
      status: 200,
      description: 'Hotel updated successfully',
      type: HotelResponseDto,
    }),
    ...adminErrors,
    notFound,
  );
}

export function ApiDeleteHotelDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a hotel (admin)',
      description:
        'Hard delete; its translations go with it. SEEDED hotels are refused ' +
        'with a 403, the same protection seeded destinations have - it keeps the ' +
        'promo with one guaranteed occupant, so the section can only be emptied ' +
        'deliberately, by switching hotels off.',
    }),
    ApiResponse({ status: 200, description: 'Hotel deleted successfully' }),
    ApiResponse({
      status: 403,
      description:
        'Forbidden - requires MANAGE_EDITORIAL, or the hotel is seeded',
      type: ForbiddenErrorDto,
    }),
    ...commonErrors,
    notFound,
  );
}

export function ApiGetHotelTranslationsDocs() {
  return applyDecorators(
    ApiOperation({ summary: "List one hotel's copy for every locale (admin)" }),
    ApiResponse({
      status: 200,
      description: 'Translations retrieved successfully',
      type: [HotelTranslationEntryDto],
    }),
    ...adminErrors,
    notFound,
  );
}

export function ApiUpsertHotelTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: "Create or update one hotel's copy for one locale (admin)",
      description:
        'Fields are wrapped in a `fields` object, matching every other ' +
        'translatable entity. Sending a field as null clears it, which is how ' +
        'the English tab "clears" copy (there is no delete route - deleting the ' +
        'base locale would strand every other locale, which falls back to it). ' +
        'Clearing the English title takes this hotel out of the running.',
    }),
    ApiResponse({
      status: 200,
      description: 'Translation saved successfully',
      type: HotelTranslationEntryDto,
    }),
    ...adminErrors,
    notFound,
  );
}
