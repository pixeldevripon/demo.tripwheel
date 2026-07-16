import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Dashboard proxy (Next 16's renamed middleware).
 *
 * In the monorepo this file held BOTH the dashboard auth guard and the public
 * site's entire i18n scheme (locale detection, locale-prefix redirects, and the
 * two locale-less rewrites for the thank-you and cancellation pages). None of
 * that belongs here: this repo has no public site and no locales - the admin UI
 * is English-only, and the 7 locales are a CONTENT workflow, not a UI one.
 *
 * What is left is the guard, carried over unchanged, plus the legacy auth
 * redirects that keep old bookmarks working.
 */

/**
 * Optimistic dashboard guard: redirect to /portal only when the session cookie
 * is absent. This is deliberately a cookie-presence check, NOT a backend call.
 *
 * The proxy runs on every dashboard navigation AND every <Link> prefetch. An
 * earlier version fetched `/api/auth/get-session` here with no internal API key,
 * so each of those requests counted against BOTH the NestJS per-IP throttle (no
 * key = no bypass) and Better Auth's own per-IP limiter. On `next start` the
 * browser, this proxy, and SSR all reach the backend as one IP (127.0.0.1
 * locally / one egress IP in prod), so that get-session storm exhausted the
 * shared bucket after a few pages - then a throttled 429 read as "no session"
 * and bounced a logged-in user to /portal, and the /portal login POST hit the
 * same exhausted bucket ("Too Many Requests").
 *
 * KEEP THIS FUNCTION FREE OF NETWORK CALLS. That property is the whole point.
 *
 * Authoritative validation still happens server-side: the dashboard layout's
 * `getUserProfile` verifies the session against the backend (forwarding the
 * internal key so it bypasses the throttle) and redirects if it is truly
 * invalid. A stale-but-well-formed cookie therefore passes here and is caught
 * one hop later.
 *
 * A genuinely MALFORMED cookie (present but not `<token>.<signature>` shaped -
 * truncated, empty-segment, or hand-tampered) is different: it would pass a
 * naive presence check, fail server validation on every request, and the
 * browser would keep resending the broken value - a redirect loop. So we detect
 * that shape and STRIP the session cookies on the redirect response, forcing a
 * clean re-login instead of a loop.
 */
function guardDashboard(request: NextRequest) {
    const sessionToken = getSessionCookie(request);

    // No session cookie at all -> not logged in.
    if (!sessionToken) {
        return NextResponse.redirect(new URL('/portal', request.url));
    }

    // A valid Better Auth session cookie is exactly `<token>.<signature>` (two
    // non-empty segments). Anything else (no dot, empty segment, or extra
    // segments from tampering) is corrupt: redirect AND clear it so the browser
    // stops resending a value that would fail server validation on every request.
    const parts = sessionToken.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        const response = NextResponse.redirect(new URL('/portal', request.url));
        clearSessionCookies(request, response);
        return response;
    }

    return NextResponse.next();
}

/**
 * Expire every Better Auth session cookie present on the request (token + data
 * cookie, in both plain and `__Secure-`-prefixed forms). Deleting by the exact
 * names seen on the request preserves whatever prefix production is using and is
 * a no-op for names that are absent.
 *
 * In production the real cookie is set with `Domain=.islandtours.esenc.cloud`
 * (crossSubDomainCookies), so the delete MUST echo that same `domain`/`path` -
 * a host-scoped delete would not match the domain-scoped cookie and the strip
 * would silently no-op exactly where it matters. Keep this default in sync with
 * `backend/src/auth/auth.instance.ts` crossSubDomainCookies.domain.
 */
function clearSessionCookies(request: NextRequest, response: NextResponse) {
    const isProd = process.env.NODE_ENV === 'production';
    const domain = isProd
        ? (process.env.COOKIE_DOMAIN ?? '.islandtours.esenc.cloud')
        : undefined;

    for (const { name } of request.cookies.getAll()) {
        if (name.includes('session_token') || name.includes('session_data')) {
            response.cookies.delete({
                name,
                path: '/',
                ...(domain && { domain }),
            });
        }
    }
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Dashboard auth guard.
    //
    // Still scoped to `/dashboard/*` because the routes still live there. Phase 6
    // moves the app to the root, at which point this inverts: guard EVERYTHING
    // except the auth doors (/portal, /staff), /onboarding and /api, and add a
    // 308 from the legacy /dashboard/* paths.
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        return guardDashboard(request);
    }

    // 2. Legacy auth redirects.
    if (pathname === '/login') {
        return NextResponse.redirect(new URL('/portal', request.url));
    }
    if (pathname === '/forgot-password') {
        return NextResponse.redirect(new URL('/portal/forgot', request.url));
    }
    if (pathname === '/reset-password') {
        const url = new URL('/portal/reset', request.url);
        url.search = request.nextUrl.search;
        return NextResponse.redirect(url);
    }

    // 3. Everything else (/portal, /staff, /onboarding, /api) passes through.
    return NextResponse.next();
}

export const config = {
    // Run on everything except Next internals and files with an extension.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
