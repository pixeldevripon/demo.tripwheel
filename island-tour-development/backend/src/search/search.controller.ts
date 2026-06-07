import { Public } from '@/auth/decorators/public.decorator';
import { TripsService } from '@/trips/trips.service';
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SearchQueryDto } from './dto/search.dto';
import { ApiSearchToursDocs } from './search.swagger';

@ApiTags('Search')
@Controller('search')
export class SearchController {
  constructor(private readonly tripsService: TripsService) {}

  @Get()
  @Public()
  @ApiSearchToursDocs()
  search(@Query() query: SearchQueryDto) {
    return this.tripsService.search({
      q: query.q,
      destinationSlug: query.destinationSlug,
      page: query.page,
      limit: query.limit,
    });
  }
}
