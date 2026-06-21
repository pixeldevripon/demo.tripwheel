import { ToursModule } from '@/tours/tours.module';
import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';

@Module({
  imports: [ToursModule], // for ToursService.search()
  controllers: [SearchController],
})
export class SearchModule {}
