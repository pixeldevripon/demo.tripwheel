import { TripsModule } from '@/trips/trips.module';
import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';

@Module({
  imports: [TripsModule], // for TripsService.search()
  controllers: [SearchController],
})
export class SearchModule {}
