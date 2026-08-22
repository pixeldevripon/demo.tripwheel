import 'server-only';

/**
 * Headers for server-to-server backend calls made by the dashboard/auth flows.
 *
 * Forwards the user's Better Auth session cookie (authenticates as that user)
 * AND the server-only internal API secret (`INTERNAL_API_SECRET`) so this
 * trusted first-party origin bypasses the backend's per-IP NestJS throttle.
 * Without the bypass, the dashboard guard's fan-out plus a page's own request
 * burst can trip the limiter, fail the check, and bounce a logged-in user to
 * /portal.
 *
 * The `server-only` import guarantees this (and the secret) can never be pulled
 * into a client bundle. NEVER read the secret as `NEXT_PUBLIC_*`.
 *
 * NOTE: this exempts requests only from the NestJS throttle. Better Auth's own
 * per-IP limiter (`/api/auth/*`) is a separate layer the key does not touch.
 */
export function serverAuthHeaders(cookie: string): Record<string, string> {
    const headers: Record<string, string> = { cookie };
    const secret = process.env.INTERNAL_API_SECRET;
    if (secret) headers['x-internal-api-key'] = secret;
    return headers;
}
