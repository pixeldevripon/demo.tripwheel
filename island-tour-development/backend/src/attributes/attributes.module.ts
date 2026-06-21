import { ToursModule } from '@/tours/tours.module';
import { Module } from '@nestjs/common';
import { AttributeDictionaryController, FiltersController, TourAttributesController } from './attributes.controller';
import { AttributesService } from './attributes.service';

@Module({
  imports: [ToursModule], // for ToursService (tour lookup + ownership checks)
  controllers: [AttributeDictionaryController, FiltersController, TourAttributesController],
  providers: [AttributesService],
  exports: [AttributesService],
})
export class AttributesModule {}
