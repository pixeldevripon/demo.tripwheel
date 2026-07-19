import { Module } from '@nestjs/common';

import { AvailabilityModule } from '@/availability/availability.module';
import { TiersModule } from '@/tiers/tiers.module';
import { ToursModule } from '@/tours/tours.module';

import { NightlyJobsService } from './nightly-jobs.service';
import { PublicCacheService } from './public-cache.service';

/**
 * Scheduled background jobs (master §7 / §3.7). `ScheduleModule.forRoot()` is
 * registered once in AppModule; this module owns the cron providers. Imports the
 * feature modules whose services the jobs call (both export their service).
 */
@Module({
  imports: [TiersModule, ToursModule, AvailabilityModule],
  providers: [NightlyJobsService, PublicCacheService],
})
export class WorkersModule {}
