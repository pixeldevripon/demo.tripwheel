import { Public } from '@/auth/decorators/public.decorator';
import { ToursService } from '@/tours/tours.service';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchQueryDto } from './dto/search.dto';
import { ApiSearchToursDocs } from './search.swagger';

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
      locale: query.locale,
      page: query.page,
      limit: query.limit,
    });
  }
}
