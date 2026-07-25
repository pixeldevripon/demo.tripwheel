import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { safeDecrypt } from '@/common/utils/crypto.util';
import { computeHashedPii, toMetaUserData } from './pii-hash.util';

/**
 * Server-side conversion tracking - the `booking_complete` event (master tracking E.8).
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
  city?: string | null;
  postalCode?: string | null;
  country?: string | null;
  clickId?: string | null; // fbclid
  eventSourceUrl?: string | null;
  eventTimeSec: number; // unix seconds
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);
  private warnedUnconfigured = false;

  constructor(private readonly prisma: PrismaService) {}

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
    const pixelId =
      seo?.facebookPixelId?.trim() || process.env.META_PIXEL_ID?.trim();
    const token =
      safeDecrypt(integrations?.metaCapiToken)?.trim() ||
      process.env.META_CAPI_TOKEN?.trim();
    const testCode =
      integrations?.metaCapiTestCode?.trim() ||
      process.env.META_CAPI_TEST_CODE?.trim();
    return {
      pixelId: pixelId || undefined,
      token: token || undefined,
      testCode: testCode || undefined,
    };
  }

  /** Fire `booking_complete` to Meta CAPI. Never throws - tracking must not break a booking. */
  async fireBookingComplete(payload: BookingCompletePayload): Promise<void> {
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

    // One shared normalization+hash pass (master 8.3) - identical to the browser
    // push's Google Enhanced-Conversions hashes; only the envelope keys differ.
    const userData: Record<string, string[] | string> = {
      ...toMetaUserData(
        computeHashedPii({
          email: payload.email,
          phone: payload.phone,
          firstName: payload.firstName,
          lastName: payload.lastName,
          city: payload.city,
          postalCode: payload.postalCode,
          country: payload.country,
        }),
      ),
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

    const body = {
      data: [
        {
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
      ],
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
          `Meta CAPI booking_complete failed (${res.status}): ${text}`,
        );
      } else {
        this.logger.log(
          `booking_complete fired (€${payload.commissionEur}, event ${payload.eventId})`,
        );
      }
    } catch (err) {
      this.logger.error('Meta CAPI request error', err as Error);
    }
  }
}
