import { Module } from '@nestjs/common';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

/**
 * Bookings module — OCTO reserve→confirm lifecycle over the `departures` inventory.
 * `PrismaService` is `@Global()`, so it is not imported here. The hold-expiry sweeper
 * (BullMQ) and Stripe payments wire into this service in Phases 5/6.
 */
@Module({
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
