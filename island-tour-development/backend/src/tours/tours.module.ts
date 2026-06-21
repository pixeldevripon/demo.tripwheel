import { Module } from '@nestjs/common';
import { ToursController } from './tours.controller';
import { TourChildrenController } from './tours-children.controller';
import { ToursService } from './tours.service';
import { TourChildrenService } from './tours-children.service';

@Module({
  controllers: [ToursController, TourChildrenController],
  providers: [ToursService, TourChildrenService],
  exports: [ToursService], // consumed by Attributes, Collections, Search, and the OCTO catalog surface
})
export class ToursModule {}
