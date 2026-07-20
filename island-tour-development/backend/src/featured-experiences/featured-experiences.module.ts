import { Module } from '@nestjs/common';
import { FeaturedExperiencesController } from './featured-experiences.controller';
import { FeaturedExperiencesService } from './featured-experiences.service';

@Module({
  controllers: [FeaturedExperiencesController],
  providers: [FeaturedExperiencesService],
})
export class FeaturedExperiencesModule {}
