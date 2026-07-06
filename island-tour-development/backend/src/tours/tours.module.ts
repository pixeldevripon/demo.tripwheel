import { Module } from '@nestjs/common';
import { AvailabilityModule } from '@/availability/availability.module';
import { ToursController } from './tours.controller';
import { TourChildrenController } from './tours-children.controller';
import { ToursService } from './tours.service';
import { TourChildrenService } from './tours-children.service';

@Module({
  // AvailabilityModule provides AvailabilityService so publish/unpause can refresh
  // the tour's `isBookable` flag (the public listing gate). No cycle: the
  // availability module never imports ToursModule.
  imports: [AvailabilityModule],
  controllers: [ToursController, TourChildrenController],
  providers: [ToursService, TourChildrenService],
  exports: [ToursService], // consumed by Attributes, Collections, Search, and the OCTO catalog surface
})
export class ToursModule {}
