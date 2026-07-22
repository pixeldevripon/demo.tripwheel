import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  REVIEW_TRANSLATION_QUEUE,
  ReviewTranslationService,
} from './review-translation.service';

export interface TranslateReviewJob {
  reviewId: string;
}

/**
 * LD32 worker. Approval enqueues; this does the six network calls.
 *
 * Off the request path on purpose: translating inline would put a moderator's
 * "Approve" click behind six third-party round trips, and a provider outage
 * would then look like a broken moderation queue. Retried with backoff, because
 * the failure mode this is most likely to hit - a rate limit or a blip - is
 * exactly the kind that succeeds on a second attempt.
 *
 * `jobId` is the review id, so BullMQ de-duplicates: approving, un-approving and
 * re-approving inside the retention window enqueues one unit of work, not three.
 */
@Processor(REVIEW_TRANSLATION_QUEUE)
export class ReviewTranslationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReviewTranslationProcessor.name);

  constructor(private readonly translation: ReviewTranslationService) {
    super();
  }

  async process(job: Job<TranslateReviewJob>): Promise<void> {
    const { reviewId } = job.data;
    const res = await this.translation.translateReview(reviewId);
    if (res.reason && res.reason !== 'not_configured') {
      this.logger.debug(`Review ${reviewId}: nothing to do (${res.reason})`);
    }
  }
}
