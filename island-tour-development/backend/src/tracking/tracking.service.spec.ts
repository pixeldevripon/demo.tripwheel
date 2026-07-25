import { TrackingService } from './tracking.service';
import { encrypt } from '@/common/utils/crypto.util';

const PAYLOAD = {
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

describe('TrackingService.fireBookingComplete', () => {
  const ENV = { ...process.env };
  let fetchSpy: jest.SpyInstance;

  // DB config absent by default -> the service falls back to the env vars, which
  // these tests set. (Dashboard-managed creds override env when present.)
  const prisma = {
    siteSEO: { findUnique: jest.fn().mockResolvedValue(null) },
    integrationsConfiguration: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
  } as any;
  const svc = () => new TrackingService(prisma);

  beforeEach(() => {
    fetchSpy = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, text: async () => '' } as Response);
  });
  afterEach(() => {
    process.env = { ...ENV };
    fetchSpy.mockRestore();
  });

  it('is a no-op when Meta CAPI is not configured', async () => {
    delete process.env.META_PIXEL_ID;
    delete process.env.META_CAPI_TOKEN;
    await svc().fireBookingComplete(PAYLOAD);
    expect(fetchSpy).not.toHaveBeenCalled();
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

  it('never throws when the network call fails', async () => {
    process.env.META_PIXEL_ID = '123';
    process.env.META_CAPI_TOKEN = 'tok';
    fetchSpy.mockRejectedValue(new Error('network down'));
    await expect(svc().fireBookingComplete(PAYLOAD)).resolves.toBeUndefined();
  });
});
