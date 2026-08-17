import { GoogleAdsService, toAdsDateTime } from './google-ads.service';
import { ConversionAuditService } from './conversion-audit.service';
import { encrypt } from '@/common/utils/crypto.util';

const PAYLOAD = {
  bookingId: 'b1',
  orderId: 'p1',
  adjustedAt: new Date('2030-06-02T09:30:00Z'),
  valueEur: 31.99,
};

const ENV_KEYS = [
  'GOOGLE_ADS_DEVELOPER_TOKEN',
  'GOOGLE_ADS_CUSTOMER_ID',
  'GOOGLE_ADS_LOGIN_CUSTOMER_ID',
  'GOOGLE_ADS_CLIENT_ID',
  'GOOGLE_ADS_CLIENT_SECRET',
  'GOOGLE_ADS_REFRESH_TOKEN',
  'GOOGLE_ADS_CONVERSION_ACTION_ID',
] as const;

/** A valid OAuth token response (first fetch call of every upload). */
const oauthOk = () =>
  ({
    ok: true,
    status: 200,
    json: async () => ({ access_token: 'ya29.token', expires_in: 3600 }),
    text: async () => '',
  }) as unknown as Response;

/** An upload response; pass a partialFailureError message to reject the row. */
const uploadRes = (
  over: { ok?: boolean; status?: number; body?: object } = {},
) =>
  ({
    ok: over.ok ?? true,
    status: over.status ?? 200,
    text: async () => JSON.stringify(over.body ?? { results: [{}] }),
  }) as unknown as Response;

describe('GoogleAdsService', () => {
  const ENV = { ...process.env };
  let fetchSpy: jest.SpyInstance;

  const prisma = {
    integrationsConfiguration: {
      findUnique: jest.fn().mockResolvedValue(null),
    },
    conversionEvent: {
      create: jest.fn().mockResolvedValue({}),
      findFirst: jest.fn().mockResolvedValue(null),
    },
  } as any;
  const svc = () =>
    new GoogleAdsService(prisma, new ConversionAuditService(prisma));

  const configureEnv = () => {
    process.env.GOOGLE_ADS_DEVELOPER_TOKEN = 'devtok';
    process.env.GOOGLE_ADS_CUSTOMER_ID = '123-456-7890'; // dashes on purpose
    process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID = '999-888-7777';
    process.env.GOOGLE_ADS_CLIENT_ID = 'cid.apps.googleusercontent.com';
    process.env.GOOGLE_ADS_CLIENT_SECRET = 'csecret';
    process.env.GOOGLE_ADS_REFRESH_TOKEN = 'rtok';
    process.env.GOOGLE_ADS_CONVERSION_ACTION_ID = '555444';
  };

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch');
    prisma.conversionEvent.create.mockClear();
    prisma.integrationsConfiguration.findUnique.mockResolvedValue(null);
  });
  afterEach(() => {
    process.env = { ...ENV };
    fetchSpy.mockRestore();
  });

  it('formats the adjustment timestamp as yyyy-MM-dd HH:mm:ss+00:00', () => {
    expect(toAdsDateTime(new Date('2030-06-02T09:30:05Z'))).toBe(
      '2030-06-02 09:30:05+00:00',
    );
  });

  it('is a warn-once no-op when not configured (no fetch, no audit row)', async () => {
    for (const key of ENV_KEYS) delete process.env[key];
    await svc().uploadRetraction(PAYLOAD);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(prisma.conversionEvent.create).not.toHaveBeenCalled();
  });

  it('uploads a RETRACTION identified by order id, with dashes stripped from customer ids', async () => {
    configureEnv();
    fetchSpy
      .mockResolvedValueOnce(oauthOk())
      .mockResolvedValueOnce(uploadRes());

    await svc().uploadRetraction(PAYLOAD);

    // Call 1: OAuth refresh grant.
    const [oauthUrl, oauthInit] = fetchSpy.mock.calls[0];
    expect(String(oauthUrl)).toBe('https://oauth2.googleapis.com/token');
    expect(
      ((oauthInit as RequestInit).body as URLSearchParams).toString(),
    ).toContain('grant_type=refresh_token');

    // Call 2: the adjustment upload.
    const [url, init] = fetchSpy.mock.calls[1];
    expect(String(url)).toContain(
      '/customers/1234567890:uploadConversionAdjustments',
    );
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['developer-token']).toBe('devtok');
    expect(headers['login-customer-id']).toBe('9998887777');
    expect(headers.Authorization).toBe('Bearer ya29.token');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.partialFailure).toBe(true);
    expect(body.conversionAdjustments[0]).toEqual({
      conversionAction: 'customers/1234567890/conversionActions/555444',
      adjustmentType: 'RETRACTION',
      orderId: 'p1',
      adjustmentDateTime: '2030-06-02 09:30:00+00:00',
    });
    // SENT audit row for the GOOGLE_ADS/ADJUSTMENT send.
    expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        bookingId: 'b1',
        platform: 'GOOGLE_ADS',
        kind: 'ADJUSTMENT',
        eventId: 'p1',
        valueEur: 31.99,
        status: 'SENT',
      }),
    });
  });

  it('caches the OAuth token across uploads (one refresh grant, two uploads)', async () => {
    configureEnv();
    fetchSpy
      .mockResolvedValueOnce(oauthOk())
      .mockResolvedValueOnce(uploadRes())
      .mockResolvedValueOnce(uploadRes());

    const service = svc();
    await service.uploadRetraction(PAYLOAD);
    await service.uploadRetraction({ ...PAYLOAD, orderId: 'p2' });

    const oauthCalls = fetchSpy.mock.calls.filter(([u]) =>
      String(u).includes('oauth2.googleapis.com'),
    );
    expect(oauthCalls).toHaveLength(1);
    expect(fetchSpy).toHaveBeenCalledTimes(3);
  });

  it('coalesces concurrent cold-cache refreshes into ONE token grant (no stampede)', async () => {
    configureEnv();
    // A bulk cancellation matures several retractions at once; the processor
    // runs 5 concurrently and they all find the cache cold.
    fetchSpy.mockImplementation((url: string | URL) =>
      Promise.resolve(
        String(url).includes('oauth2.googleapis.com') ? oauthOk() : uploadRes(),
      ),
    );

    const service = svc();
    await Promise.all([
      service.uploadRetraction({ ...PAYLOAD, orderId: 'p1' }),
      service.uploadRetraction({ ...PAYLOAD, orderId: 'p2' }),
      service.uploadRetraction({ ...PAYLOAD, orderId: 'p3' }),
    ]);

    const oauthCalls = fetchSpy.mock.calls.filter(([u]) =>
      String(u).includes('oauth2.googleapis.com'),
    );
    expect(oauthCalls).toHaveLength(1);
  });

  it('records a FAILED row and rethrows when the upload transport dies', async () => {
    configureEnv();
    fetchSpy
      .mockResolvedValueOnce(oauthOk())
      .mockRejectedValueOnce(new Error('ECONNRESET'));

    await expect(svc().uploadRetraction(PAYLOAD)).rejects.toThrow('ECONNRESET');
    expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'transport: ECONNRESET',
      }),
    });
  });

  it('re-mints the token when the credentials are rotated (no stale token after a revoke)', async () => {
    configureEnv();
    fetchSpy
      .mockResolvedValueOnce(oauthOk())
      .mockResolvedValueOnce(uploadRes())
      .mockResolvedValueOnce(oauthOk())
      .mockResolvedValueOnce(uploadRes());

    const service = svc();
    await service.uploadRetraction(PAYLOAD);
    // Admin rotates the refresh token in Settings between the two sends.
    process.env.GOOGLE_ADS_REFRESH_TOKEN = 'rotated-rtok';
    await service.uploadRetraction({ ...PAYLOAD, orderId: 'p2' });

    const oauthCalls = fetchSpy.mock.calls.filter(([u]) =>
      String(u).includes('oauth2.googleapis.com'),
    );
    expect(oauthCalls).toHaveLength(2); // cache key changed -> fresh grant
  });

  it('fails UNRECOVERABLY on an auth rejection (developer token pending approval)', async () => {
    configureEnv();
    fetchSpy.mockResolvedValueOnce(oauthOk()).mockResolvedValueOnce(
      uploadRes({
        ok: false,
        status: 403,
        body: { error: 'dev token not approved' },
      }),
    );

    await expect(svc().uploadRetraction(PAYLOAD)).rejects.toMatchObject({
      name: 'UnrecoverableError',
    });
    expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'FAILED' }),
    });
  });

  it('throws a plain (retryable) Error on a 5xx so the queue retries', async () => {
    configureEnv();
    fetchSpy
      .mockResolvedValueOnce(oauthOk())
      .mockResolvedValueOnce(uploadRes({ ok: false, status: 500 }));

    await expect(svc().uploadRetraction(PAYLOAD)).rejects.toThrow(
      /retraction failed \(500\)/,
    );
  });

  it('absorbs an ALREADY_RETRACTED partial failure as success (replay)', async () => {
    configureEnv();
    fetchSpy.mockResolvedValueOnce(oauthOk()).mockResolvedValueOnce(
      uploadRes({
        body: {
          partialFailureError: {
            message:
              'CONVERSION_ALREADY_RETRACTED: the conversion has already been retracted.',
          },
        },
      }),
    );

    await expect(svc().uploadRetraction(PAYLOAD)).resolves.toBeUndefined();
    expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: 'SENT' }),
    });
  });

  it('throws retryable on other partial failures (e.g. conversion not ingested yet)', async () => {
    configureEnv();
    fetchSpy.mockResolvedValueOnce(oauthOk()).mockResolvedValueOnce(
      uploadRes({
        body: { partialFailureError: { message: 'TOO_RECENT_CONVERSION' } },
      }),
    );

    await expect(svc().uploadRetraction(PAYLOAD)).rejects.toThrow(
      /partial failure/,
    );
    expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FAILED',
        error: 'TOO_RECENT_CONVERSION',
      }),
    });
  });

  it('fails UNRECOVERABLY when the OAuth refresh itself is rejected', async () => {
    configureEnv();
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => 'invalid_grant',
      json: async () => ({}),
    });

    await expect(svc().uploadRetraction(PAYLOAD)).rejects.toMatchObject({
      name: 'UnrecoverableError',
    });
    expect(prisma.conversionEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FAILED',
        error: expect.stringContaining('oauth:'),
      }),
    });
  });

  it('prefers dashboard DB credentials over env (DB wins)', async () => {
    configureEnv();
    // Blank DB value = unset -> env would fall through, so clear the env
    // manager id too to assert the header is omitted when neither is set.
    delete process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID;
    prisma.integrationsConfiguration.findUnique.mockResolvedValueOnce({
      googleAdsDeveloperToken: encrypt('db-devtok'),
      googleAdsCustomerId: '111',
      googleAdsLoginCustomerId: '',
      googleAdsClientId: 'db-cid',
      googleAdsClientSecret: encrypt('db-secret'),
      googleAdsRefreshToken: encrypt('db-rtok'),
      googleAdsConversionActionId: '222',
    });
    fetchSpy
      .mockResolvedValueOnce(oauthOk())
      .mockResolvedValueOnce(uploadRes());

    await svc().uploadRetraction(PAYLOAD);

    const [url, init] = fetchSpy.mock.calls[1];
    expect(String(url)).toContain('/customers/111:');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers['developer-token']).toBe('db-devtok');
    // No manager id in the DB row -> header omitted even though env has one.
    expect('login-customer-id' in headers).toBe(false);
  });
});
