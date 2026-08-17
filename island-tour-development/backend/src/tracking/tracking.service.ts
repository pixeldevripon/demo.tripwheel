import { Injectable, Logger } from '@nestjs/common';
import {
  CancellationRefund,
  ConversionEventKind,
  ConversionPlatform,
  ConversionSendStatus,
} from '@prisma/client';
import { PrismaService } from '@/prisma/prisma.service';
import { resolveField, safeDecrypt } from '@/common/utils/crypto.util';
import { ConversionAuditService } from './conversion-audit.service';
import { computeHashedPii, toMetaUserData } from './pii-hash.util';

/**
 * Server-side conversion tracking - the `booking_complete` event (master tracking E.8)
 * and its post-conversion correction (ad-conversion PRD phase 3).
 *
 * The **conversion value is `commission_amount` in EUR**, never GMV (rule #22). This
 * service fires Meta's Conversions API (CAPI) server-side so conversions survive
 * ad-blockers and ITP. It is **config-gated**: without a Pixel ID + CAPI token it is
 * a no-op (logged once), so local/dev never sends data.
 *
 * Credentials are DASHBOARD-managed (Admin -> Settings): the Pixel ID from
 * `SiteSEO.facebookPixelId`, the CAPI token (encrypted) + test code from
 * `IntegrationsConfiguration`. Env vars (`META_PIXEL_ID` / `META_CAPI_TOKEN` /
 * `META_CAPI_TEST_CODE`) remain a local-dev / first-boot fallback (DB wins).
 *
 * PII is SHA-256 hashed per Meta's advanced-matching spec (email, phone, name, geo).
 *
 * Every send attempt is recorded in `conversion_events` (audit trail, the PRD's
 * verifiability metric) - SENT or FAILED with the platform's error. The audit
 * write itself never breaks the send path.
 */
export interface BookingCompletePayload {
  bookingId: string; // conversion_events FK (audit trail)
  eventId: string; // dedupe key shared with the browser Pixel (booking publicRef)
  commissionEur: number; // conversion value
  contentId: string; // tourId
  contentName?: string | null;
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  clickId?: string | null; // fbclid
  eventSourceUrl?: string | null;
  eventTimeSec: number; // unix seconds
}

/**
 * The cancellation correction (PRD "refund events to Meta"). `eventId` is
 * `<publicRef>:refund` - deterministic, so Meta absorbs a redelivered job the
 * same way it dedups the conversion. Meta has no true retraction: this Refund
 * event is the correction signal (Events Manager / audiences), it does not
 * subtract from Ads Manager Purchase totals.
 */
export interface BookingCancelledPayload {
  bookingId: string;
  eventId: string; // `<publicRef>:refund`
  commissionEur: number; // the originally-reported conversion value
  contentId: string; // tourId
  contentName?: string | null;
  refund?: CancellationRefund | null; // FULL / PARTIAL / NONE policy verdict
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  eventTimeSec: number; // unix seconds (cancellation instant)
}

/** Shared PII slice both payloads carry (one hash pass serves every event). */
type PiiFields = Pick<
  BookingCompletePayload,
  | 'email'
  | 'phone'
  | 'firstName'
  | 'lastName'
  | 'city'
  | 'postalCode'
  | 'country'
>;

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private warnedUnconfigured = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ConversionAuditService,
  ) {}

  /**
   * Resolve Meta CAPI credentials: dashboard DB first, env fallback (DB wins).
   * Pixel ID = public (SiteSEO); token = secret (IntegrationsConfiguration, decrypted).
   */
  private async resolveMetaConfig(): Promise<{
    pixelId?: string;
    token?: string;
    testCode?: string;
  }> {
    const [seo, integrations] = await Promise.all([
      this.prisma.siteSEO.findUnique({
        where: { id: 'default' },
        select: { facebookPixelId: true },
      }),
      this.prisma.integrationsConfiguration.findUnique({
        where: { id: 'default' },
        select: { metaCapiToken: true, metaCapiTestCode: true },
      }),
    ]);
    return {
      pixelId: resolveField(seo?.facebookPixelId, process.env.META_PIXEL_ID),
      token: resolveField(
        safeDecrypt(integrations?.metaCapiToken),
        process.env.META_CAPI_TOKEN,
      ),
      testCode: resolveField(
        integrations?.metaCapiTestCode,
        process.env.META_CAPI_TEST_CODE,
      ),
    };
  }

  /** One shared normalization+hash pass (master 8.3) onto Meta's envelope. */
  private hashedMetaUserData(pii: PiiFields): Record<string, string[]> {
    return toMetaUserData(
      computeHashedPii({
        email: pii.email,
        phone: pii.phone,
        firstName: pii.firstName,
        lastName: pii.lastName,
        city: pii.city,
        postalCode: pii.postalCode,
        country: pii.country,
      }),
    );
  }

  /** Meta-platform audit row (`conversion_events`) via the shared audit service. */
  private async recordEvent(entry: {
    bookingId: string;
    kind: ConversionEventKind;
    eventId: string;
    valueEur: number;
    status: ConversionSendStatus;
    error?: string;
  }): Promise<void> {
    await this.audit.record({ platform: ConversionPlatform.META, ...entry });
  }

  /**
   * POST one event to Meta CAPI and record the attempt. Never throws - tracking
   * must not break a booking flow; a rejected send is a FAILED audit row plus an
   * error log, and the queue-level retry (when the caller runs as a job) only
   * covers transport-level throws, not HTTP rejections.
   */
  private async postCapiEvent(args: {
    bookingId: string;
    kind: ConversionEventKind;
    label: string; // log label, e.g. 'booking_complete'
    eventId: string;
    valueEur: number;
    event: Record<string, unknown>; // the single data[0] entry
  }): Promise<void> {
    const { pixelId, token, testCode } = await this.resolveMetaConfig();
    if (!pixelId || !token) {
      if (!this.warnedUnconfigured) {
        this.logger.warn(
          'Meta CAPI not configured (no Pixel ID / CAPI token in dashboard or env) - skipping conversions',
        );
        this.warnedUnconfigured = true;
      }
      return;
    }

    const body = {
      data: [args.event],
      ...(testCode && { test_event_code: testCode }),
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
        this.logger.error(
          `Meta CAPI ${args.label} failed (${res.status}): ${text}`,
        );
        await this.recordEvent({
          bookingId: args.bookingId,
          kind: args.kind,
          eventId: args.eventId,
          valueEur: args.valueEur,
          status: ConversionSendStatus.FAILED,
          error: `${res.status}: ${text}`,
        });
      } else {
        this.logger.log(
          `${args.label} fired (€${args.valueEur}, event ${args.eventId})`,
        );
        await this.recordEvent({
          bookingId: args.bookingId,
          kind: args.kind,
          eventId: args.eventId,
          valueEur: args.valueEur,
          status: ConversionSendStatus.SENT,
        });
      }
    } catch (err) {
      this.logger.error('Meta CAPI request error', err as Error);
      await this.recordEvent({
        bookingId: args.bookingId,
        kind: args.kind,
        eventId: args.eventId,
        valueEur: args.valueEur,
        status: ConversionSendStatus.FAILED,
        error: (err as Error).message,
      });
    }
  }

  /** Fire `booking_complete` to Meta CAPI. Never throws - tracking must not break a booking. */
  async fireBookingComplete(payload: BookingCompletePayload): Promise<void> {
    // One shared normalization+hash pass (master 8.3) - identical to the browser
    // push's Google Enhanced-Conversions hashes; only the envelope keys differ.
    const userData: Record<string, string[] | string> = {
      ...this.hashedMetaUserData(payload),
    };
    // `fbc` is the click id (never hashed). Meta expects the formatted cookie value
    // `fb.1.<clickTimeMs>.<fbclid>`, not a raw fbclid; we lack the exact click time,
    // so the event time is Meta's documented fallback. An already-formatted value
    // (starts with `fb.`) is passed through untouched.
    if (payload.clickId) {
      userData.fbc = payload.clickId.startsWith('fb.')
        ? payload.clickId
        : `fb.1.${payload.eventTimeSec * 1000}.${payload.clickId}`;
    }

    await this.postCapiEvent({
      bookingId: payload.bookingId,
      kind: ConversionEventKind.CONVERSION,
      label: 'booking_complete',
      eventId: payload.eventId,
      valueEur: payload.commissionEur,
      event: {
        event_name: 'Purchase',
        event_id: payload.eventId,
        event_time: payload.eventTimeSec,
        action_source: 'website',
        ...(payload.eventSourceUrl && {
          event_source_url: payload.eventSourceUrl,
        }),
        user_data: userData,
        custom_data: {
          currency: 'EUR',
          value: payload.commissionEur,
          content_type: 'product',
          content_ids: [payload.contentId],
          ...(payload.contentName && { content_name: payload.contentName }),
        },
      },
    });
  }

  /**
   * Fire the cancellation correction to Meta CAPI (standard `Refund` event,
   * ad-conversion PRD). `action_source: 'system_generated'` - the cancellation
   * is executed by ops/admin, not by a page visit, so there is no source URL.
   * Never throws, same contract as the conversion fire.
   */
  async fireBookingCancelled(payload: BookingCancelledPayload): Promise<void> {
    await this.postCapiEvent({
      bookingId: payload.bookingId,
      kind: ConversionEventKind.REFUND,
      label: 'booking_cancelled refund',
      eventId: payload.eventId,
      valueEur: payload.commissionEur,
      event: {
        event_name: 'Refund',
        event_id: payload.eventId,
        event_time: payload.eventTimeSec,
        action_source: 'system_generated',
        user_data: this.hashedMetaUserData(payload),
        custom_data: {
          currency: 'EUR',
          value: payload.commissionEur,
          content_type: 'product',
          content_ids: [payload.contentId],
          ...(payload.contentName && { content_name: payload.contentName }),
          // Policy verdict rides along so Meta-side audiences/reports can
          // distinguish a refunded cancellation from a kept-deposit one.
          ...(payload.refund && { cancellation_refund: payload.refund }),
        },
      },
    });
  }
}
