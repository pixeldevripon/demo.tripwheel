import {
  BadRequestErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  FaqGroupResponseDto,
  FaqTranslationEntryDto,
} from '@/common/faq/dto/faq-group.dto';
import {
  HomePageResponseDto,
  HomePageTranslationEntryDto,
  PublicHomePageResponseDto,
} from './dto/home-page.dto';

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

export function ApiGetPublicHomePageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get homepage content for a locale (no auth)',
      description:
        'Every field is nullable, and null means the frontend keeps its ' +
        'built-in dictionary default. Never 404s: an unconfigured homepage ' +
        'returns an all-null payload rather than an error, so the public page ' +
        'renders whether or not an admin has entered any content.',
    }),
    ApiResponse({
      status: 200,
      description: 'Homepage content retrieved successfully',
      type: PublicHomePageResponseDto,
    }),
    ...commonErrors,
  );
}

export function ApiGetHomePageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Get homepage content with every locale (admin)',
      description: 'Self-seeds the singleton row on first read.',
    }),
    ApiResponse({
      status: 200,
      description: 'Homepage content retrieved successfully',
      type: HomePageResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateHomePageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update locale-agnostic homepage content (admin)',
      description:
        'Only the named fields are touched; an explicit null clears a field ' +
        'back to its bundled default.',
    }),
    ApiResponse({
      status: 200,
      description: 'Homepage content updated successfully',
      type: HomePageResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiGetHomePageTranslationsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List stored homepage copy for every locale' }),
    ApiResponse({
      status: 200,
      description: 'Translations retrieved successfully',
      type: [HomePageTranslationEntryDto],
    }),
    ...adminErrors,
  );
}

// ── FAQs ─────────────────────────────────────────────────────────────────────
// `entityId` is always the HomePage singleton key ('default'); anything else
// 404s. It exists in the path so the dashboard's shared FAQ manager works here
// without a special case.

export function ApiGetHomePageFaqGroupsDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List homepage FAQ groups (admin)' }),
    ApiResponse({
      status: 200,
      description: 'FAQ groups retrieved successfully',
      type: [FaqGroupResponseDto],
    }),
    ...adminErrors,
  );
}

export function ApiCreateHomePageFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Add a homepage FAQ (admin)',
      description:
        'Creates the English base row; other locales are translations.',
    }),
    ApiResponse({
      status: 201,
      description: 'FAQ created successfully',
      type: FaqGroupResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpdateHomePageFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update a homepage FAQ group (admin)',
      description:
        'Group-level attributes (displayOrder, isActive) apply across every ' +
        'locale row at once.',
    }),
    ApiResponse({
      status: 200,
      description: 'FAQ updated successfully',
      type: FaqGroupResponseDto,
    }),
    ...adminErrors,
  );
}

export function ApiDeleteHomePageFaqGroupDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a homepage FAQ group (admin)',
      description: 'Removes every locale row of the group.',
    }),
    ApiResponse({ status: 200, description: 'FAQ deleted successfully' }),
    ...adminErrors,
  );
}

export function ApiUpsertHomePageFaqTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Translate a homepage FAQ into one locale (admin)',
      description:
        'Flat `{ question, answer }` payload - FAQ translations do not use the ' +
        '`fields` wrapper that entity translations do.',
    }),
    ApiResponse({
      status: 200,
      description: 'Translation saved successfully',
      type: FaqTranslationEntryDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpsertHomePageTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create or update homepage copy for one locale',
      description:
        'Fields are wrapped in a `fields` object, matching every other ' +
        'translatable entity. Sending a field as null clears it, which is how ' +
        'the English tab "clears" copy (there is no delete route - deleting the ' +
        'base locale would strand the section headings). The search-engine ' +
        'meta title and description are per-locale copy on this same record: ' +
        'the homepage singleton has no page-content record to hold them.',
    }),
    ApiResponse({
      status: 200,
      description: 'Translation saved successfully',
      type: HomePageTranslationEntryDto,
    }),
    ...adminErrors,
  );
}
