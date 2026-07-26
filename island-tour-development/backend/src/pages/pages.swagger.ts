import {
  BadRequestErrorDto,
  ConflictErrorDto,
  ForbiddenErrorDto,
  InternalServerErrorDto,
  NotFoundErrorDto,
  UnauthorizedErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import {
  PageListItemDto,
  PageResponseDto,
  PageTranslationEntryDto,
  PublicPageResponseDto,
} from './dto/pages.dto';

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
  description: 'Page not found',
  type: NotFoundErrorDto,
});

const slugConflict = ApiResponse({
  status: 409,
  description:
    'Slug conflict - already a page, a destination, or a reserved platform route',
  type: ConflictErrorDto,
});

export function ApiGetPublicPageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Resolve a published page by permalink (no auth)',
      description:
        'Returns the page content for the requested locale, falling back to ' +
        'English (with `isEnglishFallback: true`) when that locale has no ' +
        'translation. A renamed permalink returns `redirectToSlug` instead of ' +
        'content — the frontend must 301 to it. Drafts and archived pages 404.',
    }),
    ApiResponse({
      status: 200,
      description: 'Page resolved successfully',
      type: PublicPageResponseDto,
    }),
    notFound,
    ...commonErrors,
  );
}

export function ApiListPagesDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'List every page with its English title (admin)' }),
    ApiResponse({
      status: 200,
      description: 'Pages retrieved successfully',
      type: [PageListItemDto],
    }),
    ...adminErrors,
  );
}

export function ApiCreatePageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create a page as DRAFT (admin)',
      description:
        'Creates the page and its English base translation atomically. The ' +
        'slug is generated from the title when omitted, and must not collide ' +
        'with a destination, another page, or a reserved platform route.',
    }),
    ApiResponse({
      status: 201,
      description: 'Page created successfully',
      type: PageResponseDto,
    }),
    slugConflict,
    ...adminErrors,
  );
}

export function ApiGetPageDocs() {
  return applyDecorators(
    ApiOperation({ summary: 'Get a page with every stored locale (admin)' }),
    ApiResponse({
      status: 200,
      description: 'Page retrieved successfully',
      type: PageResponseDto,
    }),
    notFound,
    ...adminErrors,
  );
}

export function ApiUpdatePageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Update locale-agnostic page fields (admin)',
      description:
        'Renaming the slug of a PUBLISHED page automatically records a 301 ' +
        'from the old permalink in the same transaction. Draft renames write ' +
        'no redirect — the URL was never public.',
    }),
    ApiResponse({
      status: 200,
      description: 'Page updated successfully',
      type: PageResponseDto,
    }),
    notFound,
    slugConflict,
    ...adminErrors,
  );
}

export function ApiUpdatePageStatusDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Publish / unpublish / archive a page (admin)',
      description:
        'Publishing requires an English title and body (the page would ' +
        'otherwise be an empty shell on every locale). `publishedAt` is ' +
        'stamped on the FIRST publish and kept across cycles.',
    }),
    ApiResponse({
      status: 200,
      description: 'Status updated successfully',
      type: PageResponseDto,
    }),
    notFound,
    ...adminErrors,
  );
}

export function ApiDeletePageDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Delete a page (admin)',
      description:
        'Refused for PUBLISHED pages — unpublish first, so killing a live ' +
        'URL is always an explicit two-step. Translations and redirect rows ' +
        'go with the page.',
    }),
    ApiResponse({ status: 200, description: 'Page deleted successfully' }),
    notFound,
    ApiResponse({
      status: 409,
      description: 'Page is published - unpublish before deleting',
      type: ConflictErrorDto,
    }),
    ...adminErrors,
  );
}

export function ApiUpsertPageTranslationDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Create or update page content for one locale (admin)',
      description:
        'Fields are wrapped in a `fields` object, matching every other ' +
        'translatable entity. The body is sanitized server-side on this write ' +
        'path — that is what makes the stored HTML safe to render directly. ' +
        'Creating a brand-new locale row requires both title and body.',
    }),
    ApiResponse({
      status: 200,
      description: 'Content saved successfully',
      type: PageTranslationEntryDto,
    }),
    notFound,
    ...adminErrors,
  );
}
