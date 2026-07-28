import { INTERNAL_API_KEY_HEADER } from './internal-origin.util';
import { TrustedOriginThrottlerGuard } from './trusted-origin-throttler.guard';

/**
 * `getTracker` is protected; this exposes it for the tests without loosening
 * the class itself.
 */
class ExposedGuard extends TrustedOriginThrottlerGuard {
  track(req: Record<string, unknown>): Promise<string> {
    return this.getTracker(req);
  }
}

describe('TrustedOriginThrottlerGuard.getTracker', () => {
  const ORIGINAL = process.env.INTERNAL_API_SECRET;
  const SECRET = 's3cret-value';
  // The guard only uses inherited members that getTracker does not touch, so an
  // unconstructed-dependency instance is safe here.
  const guard = new ExposedGuard({ throttlers: [] }, {} as never, {} as never);

  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = SECRET;
  });

  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.INTERNAL_API_SECRET;
    else process.env.INTERNAL_API_SECRET = ORIGINAL;
  });

  it('tracks an anonymous request by its own IP', async () => {
    await expect(guard.track({ ip: '203.0.113.9', headers: {} })).resolves.toBe(
      '203.0.113.9',
    );
  });

  it('IGNORES a forwarded client IP from an untrusted caller', async () => {
    // Otherwise any browser could mint itself a fresh bucket per request.
    await expect(
      guard.track({
        ip: '203.0.113.9',
        headers: { 'x-real-client-ip': '198.51.100.4' },
      }),
    ).resolves.toBe('203.0.113.9');
  });

  it('tracks by the forwarded visitor IP for a trusted origin', async () => {
    // Without this, every traveller's SSR-originated conversion claim would
    // share ONE bucket keyed on the renderer's egress IP.
    await expect(
      guard.track({
        ip: '203.0.113.9',
        headers: {
          [INTERNAL_API_KEY_HEADER]: SECRET,
          'x-real-client-ip': '198.51.100.4',
        },
      }),
    ).resolves.toBe('fwd:198.51.100.4');
  });

  it('takes the first entry of a forwarded chain', async () => {
    await expect(
      guard.track({
        ip: '203.0.113.9',
        headers: {
          [INTERNAL_API_KEY_HEADER]: SECRET,
          'x-real-client-ip': '198.51.100.4, 70.41.3.18, 150.172.238.178',
        },
      }),
    ).resolves.toBe('fwd:198.51.100.4');
  });

  it('falls back to the egress IP when a trusted caller forwards nothing', async () => {
    await expect(
      guard.track({
        ip: '203.0.113.9',
        headers: { [INTERNAL_API_KEY_HEADER]: SECRET },
      }),
    ).resolves.toBe('203.0.113.9');
  });

  it('never yields an empty key', async () => {
    await expect(guard.track({ headers: {} })).resolves.toBe('unknown');
  });
});
