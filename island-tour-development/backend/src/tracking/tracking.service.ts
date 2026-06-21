import { createHash } from 'crypto';
import { Injectable, Logger } from '@nestjs/common';

/**
 * Server-side conversion tracking — the `booking_complete` event (master tracking E.8).
 *
 * The **conversion value is `commission_amount` in EUR**, never GMV (rule #22). This
 * service fires Meta's Conversions API (CAPI) server-side so conversions survive
 * ad-blockers and ITP. It is **config-gated**: without `META_PIXEL_ID` +
 * `META_CAPI_TOKEN` it is a no-op (logged once), so local/dev never sends data.
 *
 * PII is SHA-256 hashed per Meta's advanced-matching spec (email, phone, name, geo).
 */
export interface BookingCompletePayload {
  eventId: string; // dedupe key shared with the browser Pixel (booking publicRef)
  commissionEur: number; // conversion value
  contentId: string; // tourId
  contentName?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  country?: string | null;
  postalCode?: string | null;
  clickId?: string | null; // fbclid
  eventSourceUrl?: string | null;
  eventTimeSec: number; // unix seconds
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private warnedUnconfigured = false;

  /** Fire `booking_complete` to Meta CAPI. Never throws — tracking must not break a booking. */
  async fireBookingComplete(payload: BookingCompletePayload): Promise<void> {
    const pixelId = process.env.META_PIXEL_ID;
    const token = process.env.META_CAPI_TOKEN;
    if (!pixelId || !token) {
      if (!this.warnedUnconfigured) {
        this.logger.warn('Meta CAPI not configured (META_PIXEL_ID/META_CAPI_TOKEN) — skipping conversions');
        this.warnedUnconfigured = true;
      }
      return;
    }

    const userData: Record<string, string[] | string> = {};
    if (payload.email) userData.em = [sha256(payload.email)];
    if (payload.phone) userData.ph = [sha256(payload.phone)];
    if (payload.firstName) userData.fn = [sha256(payload.firstName)];
    if (payload.lastName) userData.ln = [sha256(payload.lastName)];
    if (payload.country) userData.country = [sha256(payload.country)];
    if (payload.postalCode) userData.zp = [sha256(payload.postalCode)];
    if (payload.clickId) userData.fbc = payload.clickId;

    const body = {
      data: [
        {
          event_name: 'Purchase',
          event_id: payload.eventId,
          event_time: payload.eventTimeSec,
          action_source: 'website',
          ...(payload.eventSourceUrl && { event_source_url: payload.eventSourceUrl }),
          user_data: userData,
          custom_data: {
            currency: 'EUR',
            value: payload.commissionEur,
            content_type: 'product',
            content_ids: [payload.contentId],
            ...(payload.contentName && { content_name: payload.contentName }),
          },
        },
      ],
      ...(process.env.META_CAPI_TEST_CODE && { test_event_code: process.env.META_CAPI_TEST_CODE }),
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${pixelId}/events?access_token=${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      if (!res.ok) {
        const text = await res.text();
        this.logger.error(`Meta CAPI booking_complete failed (${res.status}): ${text}`);
      } else {
        this.logger.log(`booking_complete fired (€${payload.commissionEur}, event ${payload.eventId})`);
      }
    } catch (err) {
      this.logger.error('Meta CAPI request error', err as Error);
    }
  }
}

/** SHA-256 lowercase-trimmed hash per Meta advanced-matching normalization. */
function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
