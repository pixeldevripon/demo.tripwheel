import { Module } from '@nestjs/common';
import { PlatformReviewsController } from './platform-reviews.controller';
import { PlatformReviewsService } from './platform-reviews.service';

/** Trustpilot / Google Reviews integration (master point 15). */
@Module({
  controllers: [PlatformReviewsController],
  providers: [PlatformReviewsService],
  exports: [PlatformReviewsService],
})
export class PlatformReviewsModule {}
