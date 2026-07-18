import { Public } from '@/auth/decorators/public.decorator';
import { ToursService } from '@/tours/tours.service';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchQueryDto } from './dto/search.dto';
import { ApiSearchSuggestDocs, ApiSearchToursDocs } from './search.swagger';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly toursService: ToursService) {}

  @Get()
  @Public()
  @ApiSearchToursDocs()
  search(@Query() query: SearchQueryDto) {
    return this.toursService.search({
      q: query.q,
      destinationSlug: query.destinationSlug,
      date: query.date,
      locale: query.locale,
      currency: query.currency,
      page: query.page,
      limit: query.limit,
    });
  }

  /**
   * GET /search/suggest
   *
   * Navbar typeahead: matched categories (with scoped tour counts), published
   * hubs, tours in the active destination, and a "beyond" strip from other
   * destinations when scoped.
   */
  @Get('suggest')
  @Public()
  @ApiSearchSuggestDocs()
  suggest(@Query() query: SearchQueryDto) {
    return this.toursService.suggest({
      q: query.q,
      destinationSlug: query.destinationSlug,
      locale: query.locale,
      currency: query.currency,
    });
  }
}
