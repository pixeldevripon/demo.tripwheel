/**
 * Traveler-lookup abuse limits (login spec §1, on top of the global per-IP
 * ThrottlerGuard): booking references are identifiers, not secrets, so the
 * pair login is protected by per-credential failure caps, not by secrecy.
 *
 * - 5 failed attempts per EMAIL per 15 minutes (spec figure)
 * - 10 failed attempts per REFERENCE per 15 minutes (an attacker who knows a
 *   reference and sprays emails burns this cap regardless of source IP)
 *
 * Counters are in-memory: the backend deploys as a single process (VPS
 * compose), and on restart an attacker gains nothing that the per-IP throttle
 * does not still cover. Move to the shared Redis store if the API ever scales
 * horizontally. Successful lookups clear the email counter (a traveler who
 * finally typed the reference right is not mid-attack).
 *
 * Silent until lockout (no attempt counters in responses); the lockout error
 * is uniform and reveals nothing about whether the booking exists.
 */
import {
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  OnModuleDestroy,
} from '@nestjs/common';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_EMAIL = 5;
const MAX_FAILS_PER_REFERENCE = 10;
/**
 * Hard ceiling on tracked keys. Per-key pruning only runs when a key is
 * touched AGAIN, so one-shot keys (most real traffic) would otherwise sit in
 * the map for the process lifetime - a slow leak on a long-uptime VPS. The
 * periodic sweep clears fully-stale keys; the cap is the flood backstop
 * (insertion rate is already bounded by the per-IP throttle).
 */
const MAX_TRACKED_KEYS = 50_000;

@Injectable()
export class LookupRateLimiter implements OnModuleDestroy {
  private readonly logger = new Logger(LookupRateLimiter.name);
  /** key -> failure timestamps within the current window */
  private readonly failures = new Map<string, number[]>();
  /** Periodic sweep of fully-stale keys; unref'd so it never holds the process open. */
  private readonly sweepTimer = setInterval(
    () => this.sweepStale(),
    WINDOW_MS,
  ).unref();

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  /** Drop every key whose NEWEST failure is already outside the window. */
  sweepStale(now: number = Date.now()): void {
    for (const [key, stamps] of this.failures) {
      if (!stamps.length || now - stamps[stamps.length - 1] >= WINDOW_MS) {
        this.failures.delete(key);
      }
    }
  }

  private prune(key: string, now: number): number[] {
    const kept = (this.failures.get(key) ?? []).filter(
      (t) => now - t < WINDOW_MS,
    );
    if (kept.length === 0) this.failures.delete(key);
    else this.failures.set(key, kept);
    return kept;
  }

  private static emailKey(email: string): string {
    return `e:${email.trim().toLowerCase()}`;
  }

  private static referenceKey(reference: string): string {
    return `r:${reference.trim().toUpperCase()}`;
  }

  /** Throws 429 (uniform message) when either credential is locked out. */
  assertAllowed(email: string, reference: string, ip?: string): void {
    const now = Date.now();
    const emailFails = this.prune(LookupRateLimiter.emailKey(email), now);
    const refFails = this.prune(LookupRateLimiter.referenceKey(reference), now);
    if (
      emailFails.length >= MAX_FAILS_PER_EMAIL ||
      refFails.length >= MAX_FAILS_PER_REFERENCE
    ) {
      // Ops signal, not analytics (login spec): a lockout is an attack smell.
      this.logger.warn(
        `Lookup lockout: email=${LookupRateLimiter.redact(email)} ref=${reference.trim().toUpperCase()} ip=${ip ?? 'n/a'}`,
      );
      throw new HttpException(
        'Too many attempts. Please wait a few minutes and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(email: string, reference: string, ip?: string): void {
    const now = Date.now();
    // Flood backstop: sweep before growing past the cap; if a burst outpaces
    // even that, evict oldest-inserted keys (attacker keys are the newest, so
    // active lockouts survive; legitimate one-shot keys are the safe ones to lose).
    if (this.failures.size >= MAX_TRACKED_KEYS) {
      this.sweepStale(now);
      while (this.failures.size >= MAX_TRACKED_KEYS) {
        const oldest = this.failures.keys().next().value;
        if (oldest === undefined) break;
        this.failures.delete(oldest);
      }
    }
    for (const key of [
      LookupRateLimiter.emailKey(email),
      LookupRateLimiter.referenceKey(reference),
    ]) {
      const list = this.failures.get(key) ?? [];
      list.push(now);
      this.failures.set(key, list);
    }
    this.logger.log(
      `Lookup failed: email=${LookupRateLimiter.redact(email)} ref=${reference.trim().toUpperCase()} ip=${ip ?? 'n/a'}`,
    );
  }

  recordSuccess(email: string, ip?: string): void {
    this.failures.delete(LookupRateLimiter.emailKey(email));
    this.logger.log(
      `Lookup ok: email=${LookupRateLimiter.redact(email)} ip=${ip ?? 'n/a'}`,
    );
  }

  /** j***@d***.com - enough to correlate log lines, never the address. */
  private static redact(email: string): string {
    const [local = '', domain = ''] = email.trim().toLowerCase().split('@');
    return `${local.slice(0, 1)}***@${domain.slice(0, 1)}***`;
  }
}

/** One window rule for TargetRateLimiter.consume. */
export interface TargetWindow {
  max: number;
  windowMs: number;
}

/**
 * Per-TARGET caps for the mail-sending TYP actions (resend, recover-reference,
 * cancellation-request). Their per-IP throttles stop a single client, but a
 * multi-IP caller could still spam ONE victim's inbox - these caps bound the
 * damage per publicRef / per email regardless of source. Same in-memory
 * trade-offs as LookupRateLimiter above (single-process deploy; sweep +
 * cap against unbounded growth; Redis when scaling out).
 */
@Injectable()
export class TargetRateLimiter implements OnModuleDestroy {
  private readonly logger = new Logger(TargetRateLimiter.name);
  /** `${bucket}:${key}` -> event timestamps (kept up to the largest window). */
  private readonly events = new Map<string, number[]>();
  private readonly sweepTimer = setInterval(
    () => this.sweepStale(),
    60 * 60 * 1000,
  ).unref();
  /** Largest window any consume() call has used; stale keys age out past it. */
  private maxWindowMs = 60 * 60 * 1000;

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  sweepStale(now: number = Date.now()): void {
    for (const [key, stamps] of this.events) {
      if (
        !stamps.length ||
        now - stamps[stamps.length - 1] >= this.maxWindowMs
      ) {
        this.events.delete(key);
      }
    }
  }

  /**
   * Record one event for `bucket:key` and throw 429 when any window rule is
   * already at its cap. The key is normalized (trim/lowercase) so casing
   * cannot split a target across counters.
   */
  consume(bucket: string, key: string, windows: TargetWindow[]): void {
    const now = Date.now();
    const mapKey = `${bucket}:${key.trim().toLowerCase()}`;
    this.maxWindowMs = Math.max(
      this.maxWindowMs,
      ...windows.map((w) => w.windowMs),
    );
    if (this.events.size >= MAX_TRACKED_KEYS) this.sweepStale(now);

    const stamps = (this.events.get(mapKey) ?? []).filter(
      (t) => now - t < this.maxWindowMs,
    );
    for (const { max, windowMs } of windows) {
      const inWindow = stamps.filter((t) => now - t < windowMs).length;
      if (inWindow >= max) {
        // Redact email keys (recover bucket) - no PII in logs.
        const logKey = mapKey.includes('@')
          ? `${bucket}:${mapKey.split(':')[1]?.slice(0, 1)}***`
          : mapKey;
        this.logger.warn(`Target cap hit: ${logKey}`);
        throw new HttpException(
          'Too many requests for this booking. Please wait and try again.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }
    stamps.push(now);
    this.events.set(mapKey, stamps);
  }
}
