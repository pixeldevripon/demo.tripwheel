import { TrackingService } from './tracking.service';

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
    await new TrackingService().fireBookingComplete(PAYLOAD);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('posts a hashed Purchase event with EUR commission value when configured', async () => {
    process.env.META_PIXEL_ID = '123';
    process.env.META_CAPI_TOKEN = 'tok';
    await new TrackingService().fireBookingComplete(PAYLOAD);

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

  it('never throws when the network call fails', async () => {
    process.env.META_PIXEL_ID = '123';
    process.env.META_CAPI_TOKEN = 'tok';
    fetchSpy.mockRejectedValue(new Error('network down'));
    await expect(new TrackingService().fireBookingComplete(PAYLOAD)).resolves.toBeUndefined();
  });
});
