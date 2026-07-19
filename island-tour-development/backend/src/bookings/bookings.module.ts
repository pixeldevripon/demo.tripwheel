import { Module } from '@nestjs/common';
import { TrackingModule } from '@/tracking/tracking.module';
import { NotificationsModule } from '@/notifications/notifications.module';
import { TiersModule } from '@/tiers/tiers.module';
import { FxModule } from '@/fx/fx.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';
import { LookupRateLimiter, TargetRateLimiter } from './lookup-rate-limiter';

/**
 * Bookings module - OCTO reserve→confirm lifecycle over the `departures` inventory.
 * `PrismaService` and `MailService` are `@Global()`, so they are not imported here.
 * `TrackingModule` supplies the `booking_complete` conversion firer. Stripe payments
 * (Phase 6) wire into this service via `confirmFromPayment`. `NotificationsModule`
 * supplies `AVAILABILITY_UPDATE` / `BOOKING_UPDATE` webhooks.
 */
@Module({
  imports: [TrackingModule, NotificationsModule, TiersModule, FxModule],
  controllers: [BookingsController],
  providers: [BookingsService, LookupRateLimiter, TargetRateLimiter],
  exports: [BookingsService, TargetRateLimiter],
})
export class BookingsModule {}
