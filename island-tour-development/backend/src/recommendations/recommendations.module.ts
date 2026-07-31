import { Module } from '@nestjs/common';
import { RecommendationsController } from './recommendations.controller';
import { RecommendationsService } from './recommendations.service';

@Module({
  controllers: [RecommendationsController],
  providers: [RecommendationsService],
  // Exported so the booking-confirmation email can feature a recommendation.
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
