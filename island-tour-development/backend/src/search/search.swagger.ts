import {
  BadRequestErrorDto,
  InternalServerErrorDto,
} from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SearchResultsResponseDto } from './dto/search.dto';

export function ApiSearchToursDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Full-text tour search (public)',
      description:
        'Searches tour title/description/highlights + category & hub names (V2 §10). ' +
        'Optionally scope to a destination via `destinationSlug`; otherwise global. ' +
        'Results use the Recommended ordering. V1 is case-insensitive substring matching; ' +
        'ranking/typo-tolerance (tsvector or Algolia) is the documented upgrade path.',
    }),
    ApiResponse({ status: 200, type: SearchResultsResponseDto }),
    ApiResponse({ status: 400, type: BadRequestErrorDto }),
    ApiResponse({ status: 500, type: InternalServerErrorDto }),
  );
}

export function ApiSearchSuggestDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'Typeahead suggestions across entity types (public)',
      description:
        'Feeds the navbar search dropdown: matched categories (with a ' +
        'destination-scoped LIVE-tour count), matched published hubs, matched ' +
        'published collections, tours inside the active destination, and a ' +
        '"beyond" strip of tours from other destinations when ' +
        '`destinationSlug` is set. Same matching rules as GET /search, small ' +
        'fixed page sizes. Every category/hub/collection carries `image` - ' +
        "that page's own hero photo, nullable - so the dropdown row can show " +
        'where it leads instead of a generic glyph.',
    }),
    ApiResponse({
      status: 200,
      description:
        'Suggestion buckets: { query, total, categories, hubs, collections, tours, beyondTours }',
    }),
    ApiResponse({ status: 400, type: BadRequestErrorDto }),
    ApiResponse({ status: 500, type: InternalServerErrorDto }),
  );
}
