import { Module } from '@nestjs/common';
import { BookingsModule } from '@/bookings/bookings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

/**
 * Payments module - Stripe charges + webhook settlement over bookings.
 * `PrismaService` is `@Global()`. Imports `BookingsModule` to settle bookings
 * (`confirmFromPayment`) when a charge succeeds.
 */
@Module({
  imports: [BookingsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, StripeService],
  exports: [PaymentsService, StripeService],
})
export class PaymentsModule {}
