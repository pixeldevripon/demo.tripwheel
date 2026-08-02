import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { AvailabilityModule } from '@/availability/availability.module';
import { BookingsModule } from '@/bookings/bookings.module';
import { SettlementsModule } from '@/settlements/settlements.module';
import { TiersModule } from '@/tiers/tiers.module';
import { ReviewsModule } from '@/reviews/reviews.module';
import { ToursModule } from '@/tours/tours.module';
import { buildRedisConnection } from '@/common/utils/redis.util';

import { NightlyJobsService } from './nightly-jobs.service';
import { OutboxRelayService } from './outbox-relay.service';
import { PlatformJobsProcessor } from './platform-jobs.processor';
import { PLATFORM_QUEUE } from './platform-queue';
import { PublicCacheService } from './public-cache.service';

/**
 * Scheduled background jobs (master §7 / §3.7). `ScheduleModule.forRoot()` is
 * registered once in AppModule; this module owns the cron providers. Imports the
 * feature modules whose services the jobs call (both export their service).
 *
 * B6: also owns the durable platform queue - the OutboxRelayService bridges
 * committed `outbox_events` rows to BullMQ, and the PlatformJobsProcessor
 * consumes them (confirmation email, operator notice, CAPI conversion,
 * pre-tour reminder, refund retry). Producers never inject the queue: they
 * only write outbox rows inside their own transactions.
 */
@Module({
  imports: [
    TiersModule,
    ToursModule,
    AvailabilityModule,
    ReviewsModule,
    BookingsModule,
    SettlementsModule,
    BullModule.registerQueue({
      name: PLATFORM_QUEUE,
      connection: buildRedisConnection(),
    }),
  ],
  providers: [
    NightlyJobsService,
    PublicCacheService,
    OutboxRelayService,
    PlatformJobsProcessor,
  ],
})
export class WorkersModule {}
