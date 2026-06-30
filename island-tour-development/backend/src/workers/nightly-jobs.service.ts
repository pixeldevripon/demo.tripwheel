import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TiersService } from '@/tiers/tiers.service';
import { ToursService } from '@/tours/tours.service';

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
  ) {}

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
  }> {
    this.logger.log('Nightly jobs: starting');
    const spotlight = await this.tiers.runSpotlightLifecycle();
    const demand = await this.tours.recomputeLikelyToSellOut();
    this.logger.log(
      `Nightly jobs: spotlight(activated=${spotlight.activated}, expired=${spotlight.expired}) ` +
        `demand(evaluated=${demand.evaluated}, flagged=${demand.flagged})`,
    );
    return { spotlight, demand };
  }
}
