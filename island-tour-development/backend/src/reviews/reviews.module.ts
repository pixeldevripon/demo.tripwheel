import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { buildRedisConnection } from '@/common/utils/redis.util';
import { MailModule } from '@/mail/mail.module';
import { MediaGalleryModule } from '@/media-gallery/media-gallery.module';
import { ReviewTranslationProcessor } from './review-translation.processor';
import {
  REVIEW_TRANSLATION_QUEUE,
  ReviewTranslationService,
} from './review-translation.service';
import { ReviewInvitationsController } from './review-invitations.controller';
import { ReviewInvitationsService } from './review-invitations.service';
import { ReviewsController } from './reviews.controller';
import { ReviewRequestsService } from './review-requests.service';
import { ReviewsService } from './reviews.service';

/**
 * Reviews module - per-tour, booking-gated reviews + moderation + cached aggregates.
 * `PrismaService` is `@Global()`. Aggregates write back to Tour/Operator on moderation.
 *
 * `ReviewInvitationsController` is registered FIRST so its concrete
 * `reviews/invitation/:token` routes are matched before `ReviewsController`'s
 * `reviews/:id`, which would otherwise swallow `invitation` as an id.
 */
@Module({
  imports: [
    MailModule,
    // BE-16: the tokenized review page uploads photos through the same
    // Cloudinary service the media library uses, rather than a second client.
    MediaGalleryModule,
    // LD32 translation runs off the request path: approving a review must not
    // wait on six third-party round trips, and a provider outage must not look
    // like a broken moderation queue.
    BullModule.registerQueue({
      name: REVIEW_TRANSLATION_QUEUE,
      connection: buildRedisConnection(),
    }),
  ],
  controllers: [ReviewInvitationsController, ReviewsController],
  providers: [
    ReviewsService,
    ReviewInvitationsService,
    ReviewRequestsService,
    ReviewTranslationService,
    ReviewTranslationProcessor,
  ],
  exports: [
    ReviewsService,
    ReviewInvitationsService,
    ReviewRequestsService,
    ReviewTranslationService,
  ],
})
export class ReviewsModule {}
