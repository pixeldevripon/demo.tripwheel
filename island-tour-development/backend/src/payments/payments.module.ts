import { Module } from '@nestjs/common';
import { BookingsModule } from '@/bookings/bookings.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MollieModule } from './mollie.module';
import { StripeModule } from './stripe.module';

/**
 * Payments module - Stripe/Mollie charges + webhook settlement over bookings.
 * `PrismaService` is `@Global()`. Imports `BookingsModule` to settle bookings
 * (`confirmFromPayment`) when a charge succeeds, and the provider modules for
 * their clients (the admin-selected `payment_settings.activeProvider` decides
 * which one charges at checkout).
 */
@Module({
  imports: [BookingsModule, StripeModule, MollieModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService, StripeModule, MollieModule],
})
export class PaymentsModule {}
