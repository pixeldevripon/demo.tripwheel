import { Module } from '@nestjs/common';
import { MollieService } from './mollie.service';

/**
 * Mollie client as shared infrastructure - the Mollie sibling of StripeModule,
 * split for the same reason: both PaymentsModule (charges/webhooks) and
 * BookingsModule (refunds on cancel / pay-after-expiry) inject `MollieService`
 * WITHOUT a module cycle (PaymentsModule already imports BookingsModule).
 * Depends only on the @Global PrismaService.
 */
@Module({
  providers: [MollieService],
  exports: [MollieService],
})
export class MollieModule {}
