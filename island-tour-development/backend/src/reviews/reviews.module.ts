import { Module } from '@nestjs/common';
import { MailModule } from '@/mail/mail.module';
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
  imports: [MailModule],
  controllers: [ReviewInvitationsController, ReviewsController],
  providers: [ReviewsService, ReviewInvitationsService, ReviewRequestsService],
  exports: [ReviewsService, ReviewInvitationsService, ReviewRequestsService],
})
export class ReviewsModule {}
