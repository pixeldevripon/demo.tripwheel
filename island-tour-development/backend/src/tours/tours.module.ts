import { Module } from '@nestjs/common';
import { AvailabilityModule } from '@/availability/availability.module';
import { FxModule } from '@/fx/fx.module';
import { ToursController } from './tours.controller';
import { TourChildrenController } from './tours-children.controller';
import { ToursService } from './tours.service';
import { TourChildrenService } from './tours-children.service';
import { TourPendingChangesService } from './tour-pending-changes.service';

@Module({
  // AvailabilityModule provides AvailabilityService so publish/unpause can refresh
  // the tour's `isBookable` flag (the public listing gate). No cycle: the
  // availability module never imports ToursModule. FxModule supplies the display-rate
  // conversion for the public `money` object (guide §20.9).
  imports: [AvailabilityModule, FxModule],
  controllers: [ToursController, TourChildrenController],
  providers: [ToursService, TourChildrenService, TourPendingChangesService],
  exports: [ToursService], // consumed by Attributes, Collections, Search, and the OCTO catalog surface
})
export class ToursModule {}
