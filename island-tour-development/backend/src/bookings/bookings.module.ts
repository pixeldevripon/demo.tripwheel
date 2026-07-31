import { Module } from '@nestjs/common';
import { RateLimitModule } from '@/common/rate-limit.module';
import { CustomersModule } from '@/customers/customers.module';
import { TrackingModule } from '@/tracking/tracking.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { TiersModule } from '@/tiers/tiers.module';
import { FxModule } from '@/fx/fx.module';
import { MollieModule } from '@/payments/mollie.module';
import { StripeModule } from '@/payments/stripe.module';
import { RecommendationsModule } from '@/recommendations/recommendations.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { LookupRateLimiter } from './lookup-rate-limiter';

/**
 * Bookings module - OCTO reserve→confirm lifecycle over the `departures` inventory.
 * `PrismaService` and `MailService` are `@Global()`, so they are not imported here.
 * `TrackingModule` supplies the `booking_complete` conversion firer. Stripe payments
 * (Phase 6) wire into this service via `confirmFromPayment`. `NotificationsModule`
 * supplies `AVAILABILITY_UPDATE` / `BOOKING_UPDATE` webhooks.
 */
@Module({
  imports: [
    TrackingModule,
    NotificationsModule,
    TiersModule,
    FxModule,
    CustomersModule,
    RateLimitModule,
    StripeModule,
    MollieModule,
    RecommendationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService, LookupRateLimiter],
  // Re-export RateLimitModule so existing importers (PaymentsModule) keep
  // injecting the shared TargetRateLimiter through this module.
  exports: [BookingsService, RateLimitModule],
})
export class BookingsModule {}
