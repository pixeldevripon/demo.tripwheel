import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FaqPageType } from '@prisma/client';
import type { Queue } from 'bullmq';
import {
  CONTENT_TRANSLATION_QUEUE,
  ENQUEUE_DELAY_MS,
  mediaBucketOf,
  PAGE_TYPE_TO_ENTITY,
  type ContentEntityType,
} from './content-translation.constants';
import {
  TRANSLATION_PROVIDER,
  type TranslationProvider,
} from './providers/translation-provider.interface';

/**
 * Fire-and-forget enqueue hook, called after every English-source write
 * (entity/child translation upserts, FAQ groups, page content, sections,
 * rationales). Deliberately synchronous-void at the call site: a hook must
 * never slow down or fail the save that triggered it.
 *
 * Swallows every failure by design - BullMQ needs Redis, and if Redis is down
 * the correct outcome is untranslated content (the nightly sweep catches up),
 * not a failed save. Unconfigured provider = silent no-op (LD32 contract).
 *
 * `jobId = entityType__entityId` + a 60s delay make rapid edits collapse into
 * one job. `CONTENT_TRANSLATION_DISABLED=1` is the bulk-operation escape
 * hatch (e.g. a seed routed through services).
 */
@Injectable()
export class ContentTranslationEnqueuer {
  private readonly logger = new Logger(ContentTranslationEnqueuer.name);

  constructor(
    @InjectQueue(CONTENT_TRANSLATION_QUEUE) private readonly queue: Queue,
    @Inject(TRANSLATION_PROVIDER)
    private readonly provider: TranslationProvider,
  ) {}

  /** Queue a background translation of the whole entity (all 6 locales). */
  enqueue(entityType: ContentEntityType, entityId: string): void {
    void this.enqueueAsync(entityType, entityId);
  }

  /**
   * Same, from a pageType-shaped caller (the shared FAQ / section services).
   * Unmapped page types (tour - tours have no FAQs) are ignored silently.
   */
  enqueueForPageType(pageType: FaqPageType, entityId: string): void {
    const entityType = PAGE_TYPE_TO_ENTITY[pageType];
    if (!entityType) return;
    this.enqueue(entityType, entityId);
  }

  /**
   * Queue the BUCKET a media asset belongs to, never the asset itself.
   *
   * Exists so no call site has to remember the bucketing. Enqueuing the raw id
   * would still work - the collector accepts a uuid for the manual button - but
   * it would cost 6 provider calls per asset instead of 6 per fifty, which is
   * the difference between affordable and quota-dead. Bucket keys also make the
   * queue's jobId de-duplication collapse a burst of edits into one job.
   */
  enqueueMedia(mediaId: string): void {
    this.enqueue('media', mediaBucketOf(mediaId));
  }

  private async enqueueAsync(
    entityType: ContentEntityType,
    entityId: string,
  ): Promise<void> {
    if (process.env.CONTENT_TRANSLATION_DISABLED === '1') return;
    try {
      if (!(await this.provider.isConfigured())) return;
      await this.queue.add(
        'translate',
        { entityType, entityId },
        {
          // One job per entity: adds while a delayed/active job exists are
          // no-ops, which is the debounce. Delimiter is `__` - BullMQ rejects
          // custom job ids containing `:` (its Redis key separator).
          jobId: `${entityType}__${entityId}`,
          delay: ENQUEUE_DELAY_MS,
          attempts: 3,
          backoff: { type: 'exponential', delay: 10_000 },
          // `true`, not a count: a RETAINED completed job with this jobId
          // would block every future re-enqueue of the same entity.
          removeOnComplete: true,
          removeOnFail: 1000,
        },
      );
    } catch (err) {
      this.logger.warn(
        `Could not enqueue translation for ${entityType} ${entityId}: ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }
  }
}
