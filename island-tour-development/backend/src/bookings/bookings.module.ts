import { Module } from '@nestjs/common';
import { TrackingModule } from '@/tracking/tracking.module';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

/**
 * Bookings module — OCTO reserve→confirm lifecycle over the `departures` inventory.
 * `PrismaService` and `MailService` are `@Global()`, so they are not imported here.
 * `TrackingModule` supplies the `booking_complete` conversion firer. Stripe payments
 * (Phase 6) wire into this service via `confirmFromPayment`.
 */
@Module({
  imports: [TrackingModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
