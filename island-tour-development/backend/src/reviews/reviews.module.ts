import { Module } from '@nestjs/common';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';

/**
 * Reviews module - per-tour, booking-gated reviews + moderation + cached aggregates.
 * `PrismaService` is `@Global()`. Aggregates write back to Tour/Operator on moderation.
 */
@Module({
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
