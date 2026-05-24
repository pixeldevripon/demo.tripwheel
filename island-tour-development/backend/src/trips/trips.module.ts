import { Module } from '@nestjs/common';
import { TripsController } from './trips.controller';
import { TripChildrenController } from './trips-children.controller';
import { TripsService } from './trips.service';
import { TripChildrenService } from './trips-children.service';

@Module({
  controllers: [TripsController, TripChildrenController],
  providers: [TripsService, TripChildrenService],
  exports: [TripsService], // SlotsService will import this in Phase 5
})
export class TripsModule {}
