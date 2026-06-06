import { TripsModule } from '@/trips/trips.module';
import { Module } from '@nestjs/common';
import { CollectionsController } from './collections.controller';
import { CollectionsService } from './collections.service';

@Module({
  imports: [TripsModule], // for TripsService (manual tour resolution + dynamic filter listing)
  controllers: [CollectionsController],
  providers: [CollectionsService],
  exports: [CollectionsService],
})
export class CollectionsModule {}
