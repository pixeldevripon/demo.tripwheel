import { AvailabilityReadCache } from './availability-read-cache';

/**
 * F9's display-only read cache. The properties that matter: a hit inside the
 * TTL never re-computes, expiry IS the invalidation, distinct keys never
 * collide, and the entry cap holds against unbounded key spaces.
 */
describe('AvailabilityReadCache', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('serves a second read inside the TTL without recomputing', async () => {
    const cache = new AvailabilityReadCache();
    const compute = jest.fn().mockResolvedValue({ days: [1] });
    expect(await cache.through('k', compute)).toEqual({ days: [1] });
    expect(await cache.through('k', compute)).toEqual({ days: [1] });
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('recomputes after the 15s TTL - expiry is the invalidation', async () => {
    const cache = new AvailabilityReadCache();
    const compute = jest
      .fn()
      .mockResolvedValueOnce({ v: 'stale' })
      .mockResolvedValueOnce({ v: 'fresh' });
    await cache.through('k', compute);
    jest.advanceTimersByTime(15_001);
    expect(await cache.through('k', compute)).toEqual({ v: 'fresh' });
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('keys are isolated - different queries never share a result', async () => {
    const cache = new AvailabilityReadCache();
    await cache.through('a', jest.fn().mockResolvedValue('A'));
    expect(await cache.through('b', jest.fn().mockResolvedValue('B'))).toBe(
      'B',
    );
  });

  it('single-flights concurrent cold reads - one compute, both callers served', async () => {
    const cache = new AvailabilityReadCache();
    let resolve!: (v: string) => void;
    const compute = jest
      .fn()
      .mockReturnValue(new Promise<string>((r) => (resolve = r)));
    const [p1, p2] = [cache.through('k', compute), cache.through('k', compute)];
    resolve('once');
    expect(await p1).toBe('once');
    expect(await p2).toBe('once');
    expect(compute).toHaveBeenCalledTimes(1);
  });

  it('a rejected compute caches NOTHING - the next read retries', async () => {
    const cache = new AvailabilityReadCache();
    const compute = jest
      .fn()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('ok');
    await expect(cache.through('k', compute)).rejects.toThrow('db down');
    expect(await cache.through('k', compute)).toBe('ok');
  });

  it('caps entries so a crawler enumerating tours cannot grow it unbounded', async () => {
    const cache = new AvailabilityReadCache();
    for (let i = 0; i < 1_001; i++) {
      await cache.through(`k${i}`, jest.fn().mockResolvedValue(i));
    }
    // The oldest key was evicted; a re-read recomputes.
    const recompute = jest.fn().mockResolvedValue('recomputed');
    expect(await cache.through('k0', recompute)).toBe('recomputed');
    expect(recompute).toHaveBeenCalled();
  });
});
