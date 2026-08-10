import { Injectable } from '@nestjs/common';

/**
 * Short-TTL in-process cache for the PUBLIC availability reads (hardening
 * F9). During a rush, hundreds of widgets poll `check`/`calendar`/
 * `check-batch` for the same tour+range; a 15s hold collapses that to one
 * DB round-trip per window.
 *
 * DISPLAY-ONLY by construction: it is wired in the CONTROLLER, so nothing on
 * the booking path can ever consult it - the reserve flow's own reads and
 * the guarded claim stay live. Staleness within the TTL is by design (a
 * traveller can already race another traveller's claim between paint and
 * click; 15s changes nothing about that contract), which is also why there
 * is no invalidation: expiry IS the invalidation at this window size.
 *
 * In-process on purpose (one box today). If a second app replica appears the
 * caches simply diverge for <=15s each - correctness unaffected. Move to
 * Redis only if that ever measurably matters.
 */
@Injectable()
export class AvailabilityReadCache {
  private static readonly TTL_MS = 15_000;
  /** Bounded so a crawler enumerating tours cannot grow the map unbounded. */
  private static readonly MAX_ENTRIES = 1_000;

  private readonly store = new Map<
    string,
    { value: unknown; expires: number }
  >();

  /** Serve `compute()` through the cache under `key`. */
  async through<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = this.store.get(key);
    if (hit && hit.expires > Date.now()) return hit.value as T;
    if (hit) this.store.delete(key);

    const value = await compute();
    if (this.store.size >= AvailabilityReadCache.MAX_ENTRIES) {
      // Map iterates in insertion order: dropping the first key is a cheap
      // oldest-out eviction - plenty at this TTL.
      const oldest = this.store.keys().next().value;
      if (oldest !== undefined) this.store.delete(oldest);
    }
    this.store.set(key, {
      value,
      expires: Date.now() + AvailabilityReadCache.TTL_MS,
    });
    return value;
  }
}
