import { Module } from '@nestjs/common';
import { TiersController } from './tiers.controller';
import { TiersService } from './tiers.service';

/**
 * Tiers module — commission-tier change + Destination Spotlight request/approval, plus the
 * commercial engine helpers (`hasActiveSpotlight`, `effectiveCommissionRate`) imported by the
 * booking/ranking modules and `runSpotlightLifecycle` for the nightly BullMQ job.
 * `PrismaService` is `@Global()`, so it is not imported here. `TiersService` is exported.
 */
@Module({
  controllers: [TiersController],
  providers: [TiersService],
  exports: [TiersService],
})
export class TiersModule {}
