import { Module } from '@nestjs/common';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

/**
 * Settlements module - the money-movement ledger read surface + the scheduled
 * paid_in_full payout release (master SETTLEMENT-AND-PAYOUTS §2, B4). `PrismaService`
 * is `@Global()`. The row is WRITTEN at confirmation by `BookingsService`; this
 * module owns the release sweep (driven by the WorkersModule cron) and the admin
 * list. Exports the service so the cron can call `releaseEligiblePayouts`.
 */
@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
