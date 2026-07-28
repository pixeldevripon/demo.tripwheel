import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';

import { PrismaService } from '@/prisma/prisma.service';
import { PublicCacheService } from '@/workers/public-cache.service';

import { InstagramSyncService } from './instagram-sync.service';

const JOB_NAME = 'instagram-auto-sync';
const ACCOUNT_ID = 'default';

/** Default cadence (minutes) when the account row has no value yet: daily. */
const DEFAULT_INTERVAL_MINUTES = 1440;

/**
 * The allowed cadences mapped to a cron expression. All kept at :30 past the
 * hour and in UTC, so runs stay off the hour (no fleet-of-crons thundering herd)
 * and the daily one sits just before the 03:00 commercial nightly.
 */
const CRON_BY_MINUTES: Record<number, string> = {
  180: '30 */3 * * *', // every 3 hours
  360: '30 */6 * * *', // every 6 hours
  720: '30 */12 * * *', // every 12 hours
  1440: '30 2 * * *', // daily at 02:30
};

function cronFor(minutes: number): string {
  return CRON_BY_MINUTES[minutes] ?? CRON_BY_MINUTES[DEFAULT_INTERVAL_MINUTES];
}

/**
 * The automatic Instagram sync. In-process cron via `@nestjs/schedule`'s
 * `SchedulerRegistry` (rather than a static `@Cron` decorator) so the cadence is
 * DASHBOARD-CONFIGURABLE: `applySchedule()` reads the configured interval and
 * (re)registers the job, and `InstagramService.updateAccount` calls it again
 * whenever the admin changes the frequency, so the change takes effect live with
 * no restart. Lives inside the Instagram module so the feature stays
 * self-contained; the sync is idempotent, so it needs no BullMQ retry harness.
 *
 * The service does the real work (refresh-if-needed → fetch → mirror → upsert)
 * and swallows its own failures into `lastSyncStatus`; this wrapper only
 * schedules it and, when tiles actually changed, busts the public cache so the
 * grid repaints without waiting out the daily `'use cache'` timer.
 */
@Injectable()
export class InstagramSyncScheduler implements OnModuleInit {
  private readonly logger = new Logger(InstagramSyncScheduler.name);

  constructor(
    private readonly sync: InstagramSyncService,
    private readonly publicCache: PublicCacheService,
    private readonly prisma: PrismaService,
    private readonly registry: SchedulerRegistry,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.applySchedule();
  }

  /**
   * (Re)register the cron from the configured interval. Idempotent: tears down
   * an existing job first, so calling it after a settings change simply swaps the
   * schedule. Best-effort - a scheduling hiccup must never break the save that
   * triggered it, so the caller ignores errors.
   */
  async applySchedule(): Promise<void> {
    const minutes = await this.resolveIntervalMinutes();
    const expression = cronFor(minutes);

    if (this.registry.getCronJobs().has(JOB_NAME)) {
      this.registry.getCronJob(JOB_NAME).stop();
      this.registry.deleteCronJob(JOB_NAME);
    }

    const job = CronJob.from({
      cronTime: expression,
      onTick: () => void this.run(),
      timeZone: 'UTC',
      start: true,
    });
    this.registry.addCronJob(JOB_NAME, job);
    this.logger.log(
      `Instagram auto-sync scheduled: "${expression}" UTC (every ${minutes} min)`,
    );
  }

  private async run(): Promise<void> {
    try {
      const result = await this.sync.syncNow();
      // Only bust the cache when the grid's contents actually moved; a no-op
      // sync (nothing connected, or nothing changed) must not thrash it.
      if (result.created + result.removed > 0) {
        await this.publicCache.revalidateTags(['instagram']);
      }
    } catch (err) {
      // syncNow already records failures in lastSyncStatus; this only guards the
      // scheduler itself so one bad night never kills the cron.
      this.logger.error(
        `Instagram auto-sync failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  private async resolveIntervalMinutes(): Promise<number> {
    const row = await this.prisma.instagramAccount.findUnique({
      where: { id: ACCOUNT_ID },
      select: { syncIntervalMinutes: true },
    });
    return row?.syncIntervalMinutes ?? DEFAULT_INTERVAL_MINUTES;
  }
}
