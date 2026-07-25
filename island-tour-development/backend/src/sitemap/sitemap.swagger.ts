import { InternalServerErrorDto } from '@/common/dto/error-responses.dto';
import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SitemapEntryDto } from './dto/sitemap.dto';

export function ApiSitemapEntriesDocs() {
  return applyDecorators(
    ApiOperation({
      summary: 'List every indexable public URL for the sitemap',
      description:
        'Returns the locale-less canonical path of every entity that currently ' +
        'renders a 200 (active destinations, LIVE tours, tour-gated categories ' +
        'and hubs, published collections), each with its last-modified timestamp. ' +
        'The public frontend expands these across all locales into sitemap.xml.',
    }),
    ApiResponse({ status: 200, type: SitemapEntryDto, isArray: true }),
    ApiResponse({ status: 500, type: InternalServerErrorDto }),
  );
}
