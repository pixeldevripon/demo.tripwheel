import { Module } from '@nestjs/common';
import { StripeModule } from '@/payments/stripe.module';
import { MollieModule } from '@/payments/mollie.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { PaymentConnectionService } from './payment-connection.service';

@Module({
  // Stripe/MollieModule exist exactly so a consumer can borrow the PSP
  // clients without importing the whole payments module (no cycle risk).
  imports: [StripeModule, MollieModule],
  controllers: [SettingsController],
  providers: [SettingsService, PaymentConnectionService],
})
export class SettingsModule {}
