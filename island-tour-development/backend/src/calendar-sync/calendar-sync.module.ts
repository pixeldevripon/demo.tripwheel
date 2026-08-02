import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { AvailabilityModule } from '@/availability/availability.module';
import { buildRedisConnection } from '@/common/utils/redis.util';
import { FeedFetcherService } from '@/common/net/feed-fetcher.service';
import { PLATFORM_QUEUE } from '@/workers/platform-queue';
import { CalendarSyncController } from './calendar-sync.controller';
import { CalendarSyncService } from './calendar-sync.service';
import { CalendarPollService } from './calendar-poll.service';
import { CalendarReconcilerService } from './calendar-reconciler.service';

/**
 * Inbound calendar sync (iCal import).
 *
 * `AvailabilityModule` is imported for `AvailabilityService`: the reconciler
 * writes exceptions and then asks IT to re-project departures, rather than
 * touching inventory itself. That indirection is the point - `departures` stays
 * the single source of truth and there is exactly one materializer.
 *
 * The platform queue is registered here too, so `CalendarPollService` can put
 * its repeatable tick on the SAME queue the workers module consumes rather than
 * standing up a second one. `CalendarPollService` is exported for the processor,
 * which is where the two modules meet.
 */
@Module({
  imports: [
    AvailabilityModule,
    BullModule.registerQueue({
      name: PLATFORM_QUEUE,
      connection: buildRedisConnection(),
    }),
  ],
  controllers: [CalendarSyncController],
  providers: [
    CalendarSyncService,
    CalendarPollService,
    CalendarReconcilerService,
    FeedFetcherService,
  ],
  exports: [CalendarSyncService, CalendarPollService],
})
export class CalendarSyncModule {}
