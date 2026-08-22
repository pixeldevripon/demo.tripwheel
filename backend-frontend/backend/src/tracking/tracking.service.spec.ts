import { TrackingService } from './tracking.service';
import { ConversionAuditService } from './conversion-audit.service';
import { encrypt } from '@/common/utils/crypto.util';
import { CancellationRefund } from '@prisma/client';

const PAYLOAD = {
  bookingId: 'b1',
  eventId: 'p1',
  commissionEur: 57.74,
  contentId: 't1',
  contentName: 'Sunset Cruise',
  email: 'Ada@X.io',
  phone: null,
  firstName: 'Ada',
  lastName: null,
  country: null,
  postalCode: null,
  clickId: null,
  eventTimeSec: 1_700_000_000,
};

const REFUND_PAYLOAD = {
  bookingId: 'b1',
  eventId: 'p1:refund',
  commissionEur: 57.74,
  contentId: 't1',
  contentName: 'Sunset Cruise',
  refund: CancellationRefund.FULL,
  email: 'Ada@X.io',
  phone: null,
  firstName: 'Ada',
  lastName: null,
  country: null,
  postalCode: null,
  eventTimeSec: 1_700_100_000,
};

describe('TrackingService', () => {
  const ENV = { ...process.env };
  let fetchSpy: jest.SpyInstance;

  // DB config absent by default -> the service falls back to the env vars, which
  // these tests set. (Dashboard-managed creds override env when present.)
  const prisma = {
    siteSEO: { findUnique: jest.fn().mockResolvedValue(null) },
    integrationsConfiguration: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    conversionEvent: { create: jest.fn().mockResolvedValue({}) },
  } as any;
  const svc = () =>
    new TrackingService(prisma, new ConversionAuditService(prisma));

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, text: async () => '' } as Response);
    prisma.conversionEvent.create.mockClear();
    prisma.conversionEvent.create.mockResolvedValue({});
  });
  afterEach(() => {
    process.env = { ...ENV };
    fetchSpy.mockRestore();
  });

  describe('fireBookingComplete', () => {
    it('is a no-op when Meta CAPI is not configured', async () => {
      delete process.env.META_PIXEL_ID;
      delete process.env.META_CAPI_TOKEN;
      await svc().fireBookingComplete(PAYLOAD);
      expect(fetchSpy).not.toHaveBeenCalled();
      // Unconfigured = nothing attempted, so no audit row either.
      expect(prisma.conversionEvent.create).not.toHaveBeenCalled();
    });

    it('posts a hashed Purchase event with EUR commission value when configured', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      await svc().fireBookingComplete(PAYLOAD);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain('/123/events?access_token=tok');
      const body = JSON.parse((init as RequestInit).body as string);
      expect(body.data[0]).toMatchObject({
        event_name: 'Purchase',
        event_id: 'p1',
        custom_data: { currency: 'EUR', value: 57.74, content_ids: ['t1'] },
      });
      // email is SHA-256 hashed, lowercased+trimmed - never sent in the clear
      expect(body.data[0].user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(body)).not.toContain('Ada@X.io');
    });

    it('records a SENT audit row (conversion_events) on success', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      await svc().fireBookingComplete(PAYLOAD);

      expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'b1',
          platform: 'META',
          kind: 'CONVERSION',
          eventId: 'p1',
          valueEur: 57.74,
          status: 'SENT',
        }),
      });
    });

    it('records a FAILED audit row with the platform error on a rejected send', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'bad event',
      });

      await expect(svc().fireBookingComplete(PAYLOAD)).resolves.toBeUndefined();
      expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          kind: 'CONVERSION',
          status: 'FAILED',
          error: '400: bad event',
        }),
      });
    });

    it('prefers the dashboard DB credentials over the env vars (DB wins)', async () => {
      // Env says one thing...
      process.env.META_PIXEL_ID = 'envpixel';
      process.env.META_CAPI_TOKEN = 'envtok';
      // ...the dashboard says another (Pixel ID in SiteSEO, token encrypted).
      prisma.siteSEO.findUnique.mockResolvedValueOnce({
        facebookPixelId: 'dbpixel',
      });
      prisma.integrationsConfiguration.findUnique.mockResolvedValueOnce({
        metaCapiToken: encrypt('dbtok'),
        metaCapiTestCode: '',
      });

      await svc().fireBookingComplete(PAYLOAD);

      const [url] = fetchSpy.mock.calls[0];
      expect(String(url)).toContain('/dbpixel/events?access_token=dbtok');
    });

    it('formats a raw fbclid into Metas fbc cookie value and sets event_source_url', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      await svc().fireBookingComplete({
        ...PAYLOAD,
        clickId: 'IwAR123',
        eventSourceUrl: 'https://island.tours/curacao/thank-you/p1',
        eventTimeSec: 1_700_000_000,
      });

      const body = JSON.parse(
        (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
      );
      // fb.1.<eventTimeMs>.<fbclid>
      expect(body.data[0].user_data.fbc).toBe('fb.1.1700000000000.IwAR123');
      expect(body.data[0].event_source_url).toBe(
        'https://island.tours/curacao/thank-you/p1',
      );
    });

    it('passes an already-formatted fbc through untouched', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      await svc().fireBookingComplete({
        ...PAYLOAD,
        clickId: 'fb.1.1699999999999.abc',
      });
      const body = JSON.parse(
        (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.data[0].user_data.fbc).toBe('fb.1.1699999999999.abc');
    });

    it('never throws when the network call fails, and records the failure', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      fetchSpy.mockRejectedValue(new Error('network down'));
      await expect(svc().fireBookingComplete(PAYLOAD)).resolves.toBeUndefined();
      expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'FAILED',
          error: 'network down',
        }),
      });
    });

    it('never throws when the audit write itself fails', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      prisma.conversionEvent.create.mockRejectedValue(new Error('db down'));
      await expect(svc().fireBookingComplete(PAYLOAD)).resolves.toBeUndefined();
      expect(fetchSpy).toHaveBeenCalledTimes(1); // the send still happened
    });
  });

  describe('fireBookingCancelled', () => {
    it('posts a Refund event with the deterministic :refund event id and the policy verdict', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      await svc().fireBookingCancelled(REFUND_PAYLOAD);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const body = JSON.parse(
        (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
      );
      expect(body.data[0]).toMatchObject({
        event_name: 'Refund',
        event_id: 'p1:refund',
        action_source: 'system_generated',
        custom_data: {
          currency: 'EUR',
          value: 57.74,
          content_ids: ['t1'],
          cancellation_refund: 'FULL',
        },
      });
      // No page context on a system-generated correction.
      expect(body.data[0].event_source_url).toBeUndefined();
      // Same one-pass hashed matching data as the conversion (never clear PII).
      expect(body.data[0].user_data.em[0]).toMatch(/^[a-f0-9]{64}$/);
      expect(JSON.stringify(body)).not.toContain('Ada@X.io');
    });

    it('records a REFUND audit row', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      await svc().fireBookingCancelled(REFUND_PAYLOAD);

      expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bookingId: 'b1',
          platform: 'META',
          kind: 'REFUND',
          eventId: 'p1:refund',
          valueEur: 57.74,
          status: 'SENT',
        }),
      });
    });

    it('omits cancellation_refund from custom_data when there is no policy verdict', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      await svc().fireBookingCancelled({ ...REFUND_PAYLOAD, refund: null });

      const body = JSON.parse(
        (fetchSpy.mock.calls[0][1] as RequestInit).body as string,
      );
      expect('cancellation_refund' in body.data[0].custom_data).toBe(false);
    });

    it('truncates the platform error to 500 chars in the audit row', async () => {
      process.env.META_PIXEL_ID = '123';
      process.env.META_CAPI_TOKEN = 'tok';
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'x'.repeat(600),
      });

      await svc().fireBookingCancelled(REFUND_PAYLOAD);

      const { error } = prisma.conversionEvent.create.mock.calls[0][0].data;
      expect(error).toHaveLength(500);
      expect(error.startsWith('400: xxx')).toBe(true);
    });

    it('is a no-op when Meta CAPI is not configured', async () => {
      delete process.env.META_PIXEL_ID;
      delete process.env.META_CAPI_TOKEN;
      await svc().fireBookingCancelled(REFUND_PAYLOAD);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });
});
