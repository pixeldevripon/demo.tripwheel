import { Module } from '@nestjs/common';
import { BookingsModule } from '@/bookings/bookings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeModule } from './stripe.module';

/**
 * Payments module - Stripe charges + webhook settlement over bookings.
 * `PrismaService` is `@Global()`. Imports `BookingsModule` to settle bookings
 * (`confirmFromPayment`) when a charge succeeds, and `StripeModule` for the client.
 */
@Module({
  imports: [BookingsModule, StripeModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, StripeModule],
})
export class PaymentsModule {}
