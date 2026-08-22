import { timingSafeEqual } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';

/**
 * Prefix `@Throttle()` uses for its per-name limit metadata
 * (`THROTTLER:LIMIT` + throttlerName). Mirrored here rather than deep-imported
 * from `@nestjs/throttler/dist/throttler.constants`, which the package does not
 * re-export from its root and could move on any upgrade.
 *
 * `internal-origin.util.spec.ts` asserts this still equals the library's own
 * constant, so a rename fails the suite LOUDLY instead of silently widening the
 * bypass back to every route.
 */
export const THROTTLER_LIMIT_METADATA_PREFIX = 'THROTTLER:LIMIT';

/**
 * Trusted first-party origin helpers, shared by the throttler `skipIf` and the
 * `TrustedOriginThrottlerGuard` tracker.
 */

/**
 * Header a trusted first-party caller uses to forward the REAL end user's IP.
 *
 * Our SSR renderers (the public frontend on Vercel, the dashboard) call the API
 * server-to-server, so `req.ip` is their egress address and is IDENTICAL for
 * every visitor. Any per-IP limit would therefore be a single platform-wide
 * bucket. When the caller proves it is first-party (the secret below) it may
 * forward the visitor's own address here, and the guard tracks by that instead
 * - restoring per-visitor limits for SSR-originated calls.
 *
 * Only honoured together with a valid `x-internal-api-key`, so an anonymous
 * client cannot spoof its way into someone else's (or a fresh) bucket.
 */
export const INTERNAL_CLIENT_IP_HEADER = 'x-real-client-ip';

/** Header carrying the shared internal secret. */
export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/** Constant-time string compare (avoids leaking the secret via timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

type HeaderBag = Record<string, string | string[] | undefined>;

/** True when these headers carry the configured internal API secret. */
export function isTrustedInternalHeaders(headers: HeaderBag): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) return false;
  const provided = headers[INTERNAL_API_KEY_HEADER];
  return typeof provided === 'string' && safeEqual(provided, secret);
}

/**
 * True when a request carries the internal API secret, identifying it as a
 * first-party call from our own SSR/build server (the Next.js frontend, or the
 * dashboard's Server Actions).
 *
 * Such calls may bypass the per-IP throttle: rate limiting exists to stop
 * abusive ANONYMOUS clients, but our SSR/build server is trusted infrastructure
 * that legitimately bursts many requests from a single origin IP while
 * prerendering (which would otherwise trip the limiter and fail the build).
 * Only this authenticated origin is exempted - unlike blanket-skipping the
 * public read endpoints, anonymous traffic to those routes stays fully
 * throttled.
 *
 * The secret is server-only (never `NEXT_PUBLIC_`), so it is never shipped to a
 * browser; browser-side requests carry no such header and remain throttled (and
 * auth is separately guarded by Better Auth's own per-path rate limiter). When
 * the secret is unset the bypass never triggers - throttling applies to all.
 *
 * IMPORTANT: this exempts requests ONLY from THIS NestJS throttle. It has no
 * effect on Better Auth's own limiter (`auth.instance.ts` rateLimit) - and
 * `/api/auth/*` is already `@SkipThrottle()`'d from the NestJS guard anyway
 * (auth.controller.ts), so login/session routes are governed solely by Better
 * Auth. Do not assume the internal key relaxes anything under `/api/auth/*`.
 *
 * NOTE: the bypass is NOT unconditional - see `hasOwnThrottleOverride`.
 */
export function isTrustedInternalOrigin(context: ExecutionContext): boolean {
  const req = context.switchToHttp().getRequest<{ headers: HeaderBag }>();
  return isTrustedInternalHeaders(req.headers);
}

/**
 * True when the handler (or its controller) declares its OWN `@Throttle()`.
 *
 * This is what scopes the internal bypass. A route only overrides the global
 * tiers when those tiers were judged too loose for it - the mail-senders
 * (resend, recover-reference, cancellation-request), the credential paths
 * (pair login, traveller OTP request/verify) and the PSP-touching settle. Those
 * limits are the whole protection, so a leaked `INTERNAL_API_SECRET` must not
 * dissolve them; the broad bypass exists for prerender fan-out, not for these.
 *
 * Using the presence of `@Throttle()` as the marker - rather than a separate
 * allow-list to maintain - means the rule cannot drift: tightening a route
 * automatically removes it from the bypass, with nothing to remember. The
 * trade-off is that such a route, if ever called from SSR, is limited by the
 * SSR egress IP; forward `INTERNAL_CLIENT_IP_HEADER` from that caller so the
 * limit lands per visitor instead (`TrustedOriginThrottlerGuard.getTracker`).
 *
 * Matched by metadata-key PREFIX so it stays correct no matter which throttler
 * names (`short`/`medium`/`long`/...) a route overrides.
 */
export function hasOwnThrottleOverride(context: ExecutionContext): boolean {
  for (const target of [context.getHandler(), context.getClass()]) {
    if (!target) continue;
    const keys = Reflect.getMetadataKeys(target) as unknown[];
    if (
      keys.some(
        (key) =>
          typeof key === 'string' &&
          key.startsWith(THROTTLER_LIMIT_METADATA_PREFIX),
      )
    ) {
      return true;
    }
  }
  return false;
}
