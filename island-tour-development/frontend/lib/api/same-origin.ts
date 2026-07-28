import type { NextRequest } from 'next/server';

/**
 * CSRF guard for Route Handlers.
 *
 * Route Handlers get no automatic CSRF protection (unlike Server Actions), and
 * a cross-site `text/plain` form-post can deliver a JSON-ish body without a
 * preflight - enough to plant a value in a victim's cookie jar, force a
 * logout, or trigger a state change with their cookies attached.
 *
 * Modern browsers always send `Sec-Fetch-Site`; fall back to an Origin host
 * check, and allow requests carrying neither header (non-browser clients can
 * already set their own cookies, so there is nothing to forge).
 *
 * Shared deliberately: this is a security control, and two copies drift.
 */
export function isSameOrigin(req: NextRequest): boolean {
    const site = req.headers.get('sec-fetch-site');
    if (site) return site === 'same-origin' || site === 'none';
    const origin = req.headers.get('origin');
    if (!origin) return true;
    try {
        return new URL(origin).host === req.nextUrl.host;
    } catch {
        return false;
    }
}
