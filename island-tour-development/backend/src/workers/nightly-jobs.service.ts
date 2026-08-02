import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { AvailabilityService } from '@/availability/availability.service';
import { BookingsService } from '@/bookings/bookings.service';
import { CalendarSyncService } from '@/calendar-sync/calendar-sync.service';
import { ContentTranslationService } from '@/content-translation/content-translation.service';
import { ReviewRequestsService } from '@/reviews/review-requests.service';
import { SettlementsService } from '@/settlements/settlements.service';
import { TiersService } from '@/tiers/tiers.service';
import { ToursService } from '@/tours/tours.service';

import { PublicCacheService } from './public-cache.service';

/**
 * Nightly platform jobs (master §7 / §3.7). In-process scheduler via
 * `@nestjs/schedule` - these are idempotent recomputes, not retry/concurrency
 * queues, so a cron is the right tool (no Redis/BullMQ needed). Each job is a
 * plain service method that can also be triggered on demand (admin endpoint /
 * seed / tests); the cron just calls them on a schedule.
 *
 * Currently wired:
 *   - Spotlight lifecycle: APPROVED -> ACTIVE at startsAt, ACTIVE -> EXPIRED at
 *     endsAt, mirroring `tour.isSponsored` (drives the §3.6 "Sponsored" badge).
 *   - Demand signal: recompute `tour.likelyToSellOut` (§3.7, "Likely to sell out").
 *
 * TODO (master §7, when built): quality_score recompute + tier eligibility/grace
 * /demotion lifecycle hook in here next to these.
 */
@Injectable()
export class NightlyJobsService {
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
    private readonly calendarSync: CalendarSyncService,
  ) {}

  /**
   * Settlement self-heal sweep (master SETTLEMENT-AND-PAYOUTS §2). Voids any
   * payout row whose booking was cancelled/expired but is still showing an
   * obligation (RECORDED -> REVERSED, net -> 0). NOTE: this sweep never PAYS
   * anything - marking a payout PAID_OUT is a manual admin action on the
   * dashboard (founder decision 2026-07-26: v1 payouts are hand-made bank
   * transfers, so only a human confirms one happened). Hourly, idempotent.
   */
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'settlement-reverse-sweep',
    timeZone: 'UTC',
  })
  async settlementReverseSweep(): Promise<void> {
    try {
      await this.settlements.reverseStaleCancelledSettlements();
    } catch (err) {
      this.logger.error(
        `Settlement reverse sweep failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  /**
   * Hold-expiry sweeper (master §5 / booking checklist flaw 4). Releases seats from
   * ON_HOLD bookings past their `utcExpiresAt` so an abandoned checkout never causes
   * a phantom sold-out. Idempotent recompute over an indexed working set, so a
   * frequent in-process `@Cron` is the right tool (no BullMQ). Every minute keeps
   * inventory tight; a no-op in the minutes nothing is stale. A payment that lands
   * AFTER expiry is handled by `confirmFromPayment`'s pay-after-expiry recovery.
   */
  @Cron(CronExpression.EVERY_MINUTE, {
    name: 'hold-expiry-sweeper',
    timeZone: 'UTC',
  })
  async holdExpirySweep(): Promise<void> {
    try {
      await this.bookings.expireStaleHolds();
    } catch (err) {
      // Never let a sweep failure kill the scheduler; the next minute retries.
      this.logger.error(
        `Hold-expiry sweep failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
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
  @Cron(CronExpression.EVERY_HOUR, {
    name: 'review-requests',
    timeZone: 'UTC',
  })
  async reviewRequestsHourly(): Promise<void> {
    try {
      await this.reviewRequests.run();
    } catch (err) {
      // Never let a mail failure kill the scheduler: the next hour retries.
      this.logger.error(
        `Review requests job failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  // 03:00 UTC daily. "Evaluated daily" is the master's cadence for both the
  // spotlight lifecycle (§7.2) and the demand signal (§3.7).
  @Cron(CronExpression.EVERY_DAY_AT_3AM, {
    name: 'nightly-commercial-jobs',
    timeZone: 'UTC',
  })
  async nightly(): Promise<void> {
    await this.run();
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
    // Calendar sync history. A 15-minute poll writes ~96 rows per connection per
    // day and almost all say "nothing changed", so the table needs trimming to
    // stay a surface an operator can read rather than a log to grep. Never fails
    // the nightly run: a full history is a nuisance, a failed job is worse.
    let syncLogs = { removed: 0 };
    try {
      syncLogs = await this.calendarSync.pruneSyncLogs();
    } catch (err) {
      this.logger.error(
        `Calendar sync log prune failed: ${err instanceof Error ? err.message : 'unknown'}`,
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
        `translation(enqueued=${translation.enqueued}) ` +
        `syncLogs(pruned=${syncLogs.removed})`,
    );
    return { spotlight, demand, materialized, bookable, quality, eligibility };
  }
}
