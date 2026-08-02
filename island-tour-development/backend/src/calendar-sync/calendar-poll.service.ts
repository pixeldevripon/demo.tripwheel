import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { CalendarSubscriptionStatus, IcalSyncTrigger } from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import {
  CALENDAR_POLL_JOB_OPTS,
  ICAL_TICK_MS,
  PLATFORM_JOBS,
  PLATFORM_QUEUE,
} from '@/workers/platform-queue';
import { CalendarSyncService } from './calendar-sync.service';

/**
 * Drives inbound calendar polling.
 *
 * ## Two jobs, not one
 * A repeatable TICK finds subscriptions whose `nextPollAt` has passed and
 * enqueues one job per subscription. Running them inline in the tick would make
 * a single slow channel delay every other operator's sync, and a crash halfway
 * through would skip whatever was left in the batch.
 *
 * ## Where the retry logic lives
 * In the database, not in BullMQ. `failureCount` and `nextPollAt` drive the
 * ladder, so the queue is left with one attempt per job (see
 * `CALENDAR_POLL_JOB_OPTS`). Two retry mechanisms stacked on one operation would
 * hammer the channel and write five sync-log rows for one real failure.
 */
@Injectable()
export class CalendarPollService implements OnModuleInit {
  private readonly logger = new Logger(CalendarPollService.name);

  /** A sync stuck this long is a crashed worker, not a slow feed. */
  private static readonly STUCK_AFTER_MS = 10 * 60 * 1_000;

  /** Ceiling per tick, so one enormous backlog cannot flood the queue. */
  private static readonly MAX_PER_TICK = 200;

  constructor(
    private readonly prisma: PrismaService,
    private readonly sync: CalendarSyncService,
    @InjectQueue(PLATFORM_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * Register the repeatable tick.
   *
   * A fixed `jobId` makes this idempotent: every instance registers the same
   * scheduler on boot, and BullMQ keeps one. Without it a three-instance deploy
   * would poll every feed three times.
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.queue.add(
        PLATFORM_JOBS.ICAL_POLL_TICK,
        {},
        {
          jobId: PLATFORM_JOBS.ICAL_POLL_TICK,
          repeat: { every: ICAL_TICK_MS },
          removeOnComplete: 20,
          removeOnFail: 50,
        },
      );
      this.logger.log(
        `iCal poll tick registered (every ${ICAL_TICK_MS / 60_000} min)`,
      );
    } catch (error: unknown) {
      // Redis being down must not stop the API from serving. The tick is
      // re-registered on the next boot, and Sync Now still works meanwhile.
      this.logger.warn(
        `Could not register the iCal poll tick: ${String(error)}`,
      );
    }
  }

  /**
   * One tick: recover stuck runs, then fan out the due ones.
   *
   * Only ever ENQUEUES. Doing the work here would serialise every operator's
   * sync behind the slowest channel in the batch.
   */
  async tick(): Promise<{ recovered: number; enqueued: number }> {
    const recovered = await this.recoverStuck();

    const due = await this.prisma.calendarSubscription.findMany({
      where: {
        autoSyncEnabled: true,
        disconnectedAt: null,
        nextPollAt: { lte: new Date() },
        // A permanently broken URL is excluded until the operator edits it -
        // `nextPollAt` is already null for those, this is belt and braces.
        status: {
          in: [
            CalendarSubscriptionStatus.ACTIVE,
            CalendarSubscriptionStatus.PENDING,
            CalendarSubscriptionStatus.ERROR,
          ],
        },
      },
      select: { id: true },
      orderBy: { nextPollAt: 'asc' },
      take: CalendarPollService.MAX_PER_TICK,
    });

    for (const subscription of due) {
      await this.queue.add(
        PLATFORM_JOBS.ICAL_POLL_ONE,
        { subscriptionId: subscription.id },
        {
          ...CALENDAR_POLL_JOB_OPTS,
          // Collapses a duplicate enqueue if a tick overlaps the previous one.
          jobId: `ical-poll:${subscription.id}`,
        },
      );
    }

    if (due.length > 0 || recovered > 0) {
      this.logger.log(
        `iCal tick: ${due.length} enqueued, ${recovered} recovered`,
      );
    }
    return { recovered, enqueued: due.length };
  }

  /** Run one subscription's pipeline. Called by the queue processor. */
  async pollOne(subscriptionId: string): Promise<void> {
    await this.sync.runSync(subscriptionId, IcalSyncTrigger.SCHEDULED);
  }

  /**
   * Reset subscriptions left mid-sync by a crashed or redeployed worker.
   *
   * Without this a killed process leaves the row `SYNCING` forever, and every
   * later tick skips it while the UI shows a spinner that never resolves.
   * Rescheduled immediately rather than dropped, so recovery is automatic.
   */
  private async recoverStuck(): Promise<number> {
    const cutoff = new Date(Date.now() - CalendarPollService.STUCK_AFTER_MS);
    const { count } = await this.prisma.calendarSubscription.updateMany({
      where: {
        status: CalendarSubscriptionStatus.SYNCING,
        updatedAt: { lt: cutoff },
      },
      data: {
        status: CalendarSubscriptionStatus.ACTIVE,
        nextPollAt: new Date(),
      },
    });
    if (count > 0) {
      this.logger.warn(`Recovered ${count} stuck calendar sync(s)`);
    }
    return count;
  }
}
