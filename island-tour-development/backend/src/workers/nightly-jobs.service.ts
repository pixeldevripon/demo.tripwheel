import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';

import { AvailabilityService } from '@/availability/availability.service';
import { BookingsService } from '@/bookings/bookings.service';
import { ContentTranslationService } from '@/content-translation/content-translation.service';
import { ReviewRequestsService } from '@/reviews/review-requests.service';
import { SettlementsService } from '@/settlements/settlements.service';
import { TiersService } from '@/tiers/tiers.service';
import { ToursService } from '@/tours/tours.service';

import {
  PLATFORM_QUEUE,
  PLATFORM_SCHEDULES,
  PLATFORM_SCHEDULE_OPTS,
} from './platform-queue';
import { PublicCacheService } from './public-cache.service';

/**
 * Scheduled platform jobs (master §7 / §3.7), SINGLE-RUNNER via BullMQ job
 * schedulers (hardening F8). These used to be in-process `@Cron` methods: a
 * second app replica double-ran every tick - merely wasteful for these
 * idempotent recomputes after F1 made seat releases atomic, but exactly the
 * concurrent-release corruption before it, and always a double-send risk for
 * the review-request mailer. Now every replica upserts the SAME scheduler ids
 * on boot (idempotent - Redis keeps one schedule per id) and whichever
 * replica's worker picks up the tick runs it alone.
 *
 * Each job body stays a plain service method that can also be invoked on
 * demand (admin endpoint / seed / tests); the PlatformJobsProcessor is the
 * only scheduled caller. Bodies no longer swallow errors: the old try/catch
 * existed to protect the in-process scheduler, but a queue worker WANTS the
 * throw - a failed sweep lands in the retained failed set (visible) and the
 * next tick is the retry (PLATFORM_SCHEDULE_OPTS: attempts 1 by design).
 */
@Injectable()
export class NightlyJobsService implements OnModuleInit {
  private readonly logger = new Logger(NightlyJobsService.name);

  constructor(
    private readonly tours: ToursService,
    private readonly tiers: TiersService,
    private readonly availability: AvailabilityService,
    private readonly publicCache: PublicCacheService,
    private readonly reviewRequests: ReviewRequestsService,
    private readonly bookings: BookingsService,
    private readonly settlements: SettlementsService,
    private readonly contentTranslation: ContentTranslationService,
    @InjectQueue(PLATFORM_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Upsert every schedule under its fixed id. Safe to run from N replicas
   * concurrently (`upsertJobScheduler` is an override-in-place). Best-effort:
   * a Redis outage at boot must not stop the app from serving - the next
   * boot (or replica) re-registers.
   */
  async onModuleInit(): Promise<void> {
    try {
      for (const schedule of Object.values(PLATFORM_SCHEDULES)) {
        await this.queue.upsertJobScheduler(
          schedule.name,
          'every' in schedule
            ? { every: schedule.every }
            : { pattern: schedule.pattern, tz: 'UTC' },
          { name: schedule.name, opts: PLATFORM_SCHEDULE_OPTS },
        );
      }
      this.logger.log(
        `Registered ${Object.values(PLATFORM_SCHEDULES).length} job schedulers`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to register job schedulers (Redis down?): ${
          err instanceof Error ? err.message : 'unknown'
        }`,
      );
    }
  }

  /**
   * Settlement self-heal sweep (master SETTLEMENT-AND-PAYOUTS §2). Voids any
   * payout row whose booking was cancelled/expired but is still showing an
   * obligation (RECORDED -> REVERSED, net -> 0). NOTE: this sweep never PAYS
   * anything - marking a payout PAID_OUT is a manual admin action on the
   * dashboard (founder decision 2026-07-26: v1 payouts are hand-made bank
   * transfers, so only a human confirms one happened). Hourly, idempotent.
   */
  async settlementReverseSweep(): Promise<void> {
    await this.settlements.reverseStaleCancelledSettlements();
  }

  /**
   * Hold-expiry sweeper (master §5 / booking checklist flaw 4). Releases seats from
   * ON_HOLD bookings past their `utcExpiresAt` so an abandoned checkout never causes
   * a phantom sold-out. Idempotent recompute over an indexed working set, so a
   * frequent in-process `@Cron` is the right tool (no BullMQ). Every minute keeps
   * inventory tight; a no-op in the minutes nothing is stale. A payment that lands
   * AFTER expiry is handled by `confirmFromPayment`'s pay-after-expiry recovery.
   */
  async holdExpirySweep(): Promise<void> {
    await this.bookings.expireStaleHolds();
  }

  /**
   * Post-tour review requests, HOURLY rather than nightly.
   *
   * "The morning after, around 10:00 local" is a different absolute instant on
   * every island, so a once-a-day job at a fixed UTC hour would either fire at
   * the wrong local time or need one cron per destination. Running hourly and
   * letting the job decide per booking (in that booking's snapshotted timezone)
   * is the version that stays correct as destinations are added.
   *
   * Cheap: the query is indexed on exactly the two working sets it scans, and it
   * is a no-op in the 23 hours a given booking is not due.
   */
  async reviewRequestsHourly(): Promise<void> {
    await this.reviewRequests.run();
  }

  /** Job body, exposed so it can be invoked outside the schedule (admin/tests). */
  async run(): Promise<{
    spotlight: { activated: number; expired: number };
    demand: { evaluated: number; flagged: number };
    materialized: { evaluated: number; failed: number };
    bookable: { evaluated: number; bookable: number };
    quality: { evaluated: number };
    eligibility: {
      evaluated: number;
      provisional: number;
      graced: number;
      demoted: number;
    };
  }> {
    this.logger.log('Nightly jobs: starting');
    const spotlight = await this.tiers.runSpotlightLifecycle();
    const demand = await this.tours.recomputeLikelyToSellOut();
    // Master: "a nightly job materializes 12 rolling months". Project schedules +
    // exceptions into departures FIRST, then recompute the §7.2 bookability gate
    // (EXISTS an open departure within 30 days) off the fresh departures.
    const materialized = await this.availability.materializeAllLive();
    const bookable = await this.availability.recomputeAllBookable();
    // §7.2 quality_score (within-tier tie-breaker) off fresh review aggregates.
    const quality = await this.tours.recomputeQualityScores();
    // §7.2 eligibility: provisional window -> flat bar -> 30d grace -> demotion.
    const eligibility = await this.tiers.runEligibilityLifecycle();
    // Everything above re-ranks/re-flags LIVE tours without a dashboard write,
    // so the public site's `'use cache'` layer never hears about it - bust the
    // coarse listing tags so hub/collection renders, listings, and search pick
    // up the new ordering on the next visit instead of waiting out the daily
    // cacheLife timer. Best-effort: never fails the job.
    await this.publicCache.revalidateTags(['tours', 'search']);
    // AI-translation backfill sweep: recovers edits lost to the active-job
    // dedup race and entities that predate the feature. Enqueue-only (the
    // worker's rate limiter governs API spend); a fully translated entity
    // costs zero provider calls via sourceHash. Never fails the nightly run.
    let translation = { enqueued: 0 };
    try {
      translation = await this.contentTranslation.enqueuePending();
    } catch (err) {
      this.logger.error(
        `Translation sweep failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
    this.logger.log(
      `Nightly jobs: spotlight(activated=${spotlight.activated}, expired=${spotlight.expired}) ` +
        `demand(evaluated=${demand.evaluated}, flagged=${demand.flagged}) ` +
        `materialized(evaluated=${materialized.evaluated}, failed=${materialized.failed}) ` +
        `bookable(evaluated=${bookable.evaluated}, bookable=${bookable.bookable}) ` +
        `quality(evaluated=${quality.evaluated}) ` +
        `eligibility(evaluated=${eligibility.evaluated}, provisional=${eligibility.provisional}, ` +
        `graced=${eligibility.graced}, demoted=${eligibility.demoted}) ` +
        `translation(enqueued=${translation.enqueued})`,
    );
    return { spotlight, demand, materialized, bookable, quality, eligibility };
  }
}
