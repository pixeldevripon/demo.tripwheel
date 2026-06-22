import { Module } from '@nestjs/common';
import { TrackingService } from './tracking.service';

/**
 * Tracking module - server-side conversion events (Meta CAPI `booking_complete`).
 * Config-gated and side-effect-only; exported for the bookings/payments finalizers.
 */
@Module({
  providers: [TrackingService],
  exports: [TrackingService],
})
export class TrackingModule {}
