import { Module } from '@nestjs/common';
import { SettlementsController } from './settlements.controller';
import { SettlementsService } from './settlements.service';

/**
 * Settlements module - the operator-payout ledger (master SETTLEMENT-AND-PAYOUTS
 * §2, B4): paid_in_full rows only, manual admin mark-paid/mark-unpaid actions,
 * and the list/summary reads. `PrismaService` is `@Global()`. The row is WRITTEN
 * at confirmation by `BookingsService`; exports the service so the WorkersModule
 * cron can call `reverseStaleCancelledSettlements` (the self-heal sweep - the
 * cron never pays anything).
 */
@Module({
  controllers: [SettlementsController],
  providers: [SettlementsService],
  exports: [SettlementsService],
})
export class SettlementsModule {}
