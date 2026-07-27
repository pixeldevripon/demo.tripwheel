import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  CONTENT_TRANSLATION_QUEUE,
  type ContentTranslationJobData,
} from './content-translation.constants';
import { ContentTranslationService } from './content-translation.service';

/**
 * Content-translation worker. Saves enqueue; this does the network calls.
 *
 * Tuned for the Gemini FREE tier (~15 requests/min): one job at a time and a
 * worker-level limiter of 8 jobs/min - a job is up to 6 provider calls (one
 * per locale), and headroom is left for the review-translation queue sharing
 * the same key. A provider failure (429, malformed output twice) THROWS out
 * of the service, which is exactly what the attempts/backoff on the job exist
 * for; locales written before the throw are skipped on retry via sourceHash.
 */
@Processor(CONTENT_TRANSLATION_QUEUE, {
  concurrency: 1,
  limiter: { max: 8, duration: 60_000 },
})
export class ContentTranslationProcessor extends WorkerHost {
  private readonly logger = new Logger(ContentTranslationProcessor.name);

  constructor(private readonly translation: ContentTranslationService) {
    super();
  }

  async process(job: Job<ContentTranslationJobData>): Promise<void> {
    const { entityType, entityId } = job.data;
    const res = await this.translation.translateEntity(entityType, entityId);
    if (res.reason) {
      this.logger.debug(
        `${entityType} ${entityId}: nothing to do (${res.reason})`,
      );
    }
  }
}
