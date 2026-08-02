/**
 * Per-visitor rate-limit headers for server-to-server calls.
 *
 * ## The problem these solve
 * Our Route Handlers and Server Components call the API server-to-server, so
 * `req.ip` at the backend is this app's single egress address - IDENTICAL for
 * every visitor. Any per-IP limit therefore degrades into ONE platform-wide
 * bucket: `POST /bookings/typ/:ref/cancellation-request` carries
 * `@Throttle({ long: 10/hr })`, which means ten cancellation requests per hour
 * for the whole platform, and one traveller looping the endpoint can hold it
 * exhausted while everyone else's request fails inside their free-cancellation
 * window.
 *
 * The backend already has the answer: `TrustedOriginThrottlerGuard.getTracker`
 * tracks by `x-real-client-ip` instead of `req.ip`, but ONLY when the request
 * also carries a valid `x-internal-api-key` - otherwise an anonymous client
 * could spoof a fresh bucket for itself.
 *
 * ## When it is SAFE to send these - read before adding a call site
 * The internal key is also what the backend's throttler `skipIf` looks at:
 *
 * ```ts
 * skipIf: (ctx) => isTrustedInternalOrigin(ctx) && !hasOwnThrottleOverride(ctx)
 * ```
 *
 * So the key means two different things depending on the ROUTE:
 *
 * - Route declares its own `@Throttle()` -> `hasOwnThrottleOverride` is true,
 *   `skipIf` is false, the tight limit still applies, and the key merely
 *   re-keys the bucket per visitor. **This is what we want.**
 * - Route has NO `@Throttle()` -> `skipIf` is true and the key BYPASSES rate
 *   limiting entirely. **Never send it there** for a user-triggered call.
 *
 * That is why the traveller `contact` and `date-change-options` GETs
 * deliberately do not use this helper: neither backend route overrides the
 * global tiers, so the key would remove their limit rather than sharpen it.
 *
 * The template for all of this is `claimConversionPush` in
 * `lib/api/public/bookings.ts`, which was the one call site that got it right.
 */
import 'server-only';

import { headers } from 'next/headers';

/**
 * Must match `INTERNAL_CLIENT_IP_HEADER` in the backend's
 * `src/auth/internal-origin.util.ts`.
 */
export const INTERNAL_CLIENT_IP_HEADER = 'x-real-client-ip';

/** Must match `INTERNAL_API_KEY_HEADER` in the same backend module. */
export const INTERNAL_API_KEY_HEADER = 'x-internal-api-key';

/**
 * The visitor's own IP. Null when it cannot be determined - the backend then
 * falls back to tracking by our egress IP, which is the old behaviour rather
 * than a failure.
 */
export async function visitorIp(): Promise<string | null> {
    try {
        const h = await headers();
        // "client, proxy1, proxy2" - the client is first. `x-real-ip` is the
        // single-value form some proxies send instead.
        const forwarded = h.get('x-forwarded-for');
        const first = forwarded?.split(',')[0]?.trim();
        return first || h.get('x-real-ip') || null;
    } catch {
        // No request scope - fall back to the platform-wide bucket.
        return null;
    }
}

/**
 * Headers that restore PER-VISITOR rate limiting on a backend route that
 * declares its own `@Throttle()`. Read the module docblock before using this
 * on a route that does not.
 *
 * Returns an empty object when the secret is unset (local dev) or the visitor
 * IP is unreadable - in both cases the call still works, it just shares the
 * egress bucket as before.
 */
export async function perVisitorThrottleHeaders(): Promise<
    Record<string, string>
> {
    const secret = process.env.INTERNAL_API_SECRET;
    if (!secret) return {};

    const clientIp = await visitorIp();
    // The key alone would only mark us trusted; without the address there is no
    // per-visitor bucket to move to, and on a `@Throttle`d route the key buys
    // nothing else. Send both or neither.
    if (!clientIp) return {};

    return {
        [INTERNAL_API_KEY_HEADER]: secret,
        [INTERNAL_CLIENT_IP_HEADER]: clientIp,
    };
}
