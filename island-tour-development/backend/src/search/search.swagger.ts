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
