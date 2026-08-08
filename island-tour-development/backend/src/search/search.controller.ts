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
      sort: query.sort,
      categoryIds: query.categoryIds,
      date: query.date,
      guests: query.guests,
      timeOfDay: query.timeOfDay,
      minPrice: query.minPrice,
      maxPrice: query.maxPrice,
      durationMin: query.durationMin,
      durationMax: query.durationMax,
      ratingMin: query.ratingMin,
      cancellationMaxHours: query.cancellationMaxHours,
      pickupAvailable: query.pickupAvailable,
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
