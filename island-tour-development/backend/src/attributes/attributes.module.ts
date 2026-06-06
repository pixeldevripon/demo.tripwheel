import { TripsModule } from '@/trips/trips.module';
import { Module } from '@nestjs/common';
import { AttributeDictionaryController, FiltersController, TourAttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';

@Module({
  imports: [TripsModule], // for TripsService (trip lookup + ownership checks)
  controllers: [AttributeDictionaryController, FiltersController, TourAttributesController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}
