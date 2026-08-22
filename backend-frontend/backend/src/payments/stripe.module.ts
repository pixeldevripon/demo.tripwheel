import { Module } from '@nestjs/common';
import { StripeService } from './stripe.service';

/**
 * Stripe client as shared infrastructure. Extracted from PaymentsModule so both
 * PaymentsModule (charges/webhooks) and BookingsModule (refunds on cancel /
 * pay-after-expiry) can inject `StripeService` WITHOUT a module cycle:
 * PaymentsModule already imports BookingsModule, so BookingsModule cannot import
 * PaymentsModule back. StripeModule depends only on the @Global PrismaService.
 */
@Module({
  providers: [StripeService],
  exports: [StripeService],
})
export class StripeModule {}
