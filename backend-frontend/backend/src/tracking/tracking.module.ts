import { Module } from '@nestjs/common';
import { ConversionAuditService } from './conversion-audit.service';
import { GoogleAdsService } from './google-ads.service';
import { TrackingService } from './tracking.service';

/**
 * Tracking module - server-side conversion events and their corrections:
 * Meta CAPI `booking_complete` + `Refund` (TrackingService), Google Ads
 * cancellation retractions (GoogleAdsService), and the shared
 * `conversion_events` audit trail (ConversionAuditService). All config-gated
 * and side-effect-only; exported for the bookings/payments finalizers.
 */
@Module({
  providers: [TrackingService, GoogleAdsService, ConversionAuditService],
  exports: [TrackingService, GoogleAdsService, ConversionAuditService],
})
export class TrackingModule {}
