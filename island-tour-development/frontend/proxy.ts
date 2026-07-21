import {
    ALL_LOCALES,
    CURRENCY_COOKIE,
    DEFAULT_LOCALE,
    LOCALE_COOKIE,
    isCurrency,
    isLocale,
} from '@/lib/constants/locales';
import { countryFromHeaders, currencyFromCountry } from '@/lib/currency/geo';
import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Path prefixes that are NOT part of the localized public site - they must
 * never receive a `/{locale}` prefix (admin panel, auth flows, API).
 *
 * The login-surfaces group (app/(login)/*) is intentionally locale-free: the
 * traveler surface resolves locale via Accept-Language/cookie without a prefix
 * (spec 2.1), and the operator/admin/apply surfaces are single-locale.
 */
// `/bookings` moved UNDER the locale segment (`/{locale}/bookings`) - the bare
// path now goes through the standard locale redirect like any public page.
// `/onboarding` dropped with the dashboard extraction - the operator onboarding
// route now lives in the dashboard repo, so there is nothing here to exempt.
const NON_LOCALIZED_PREFIXES = [
    '/dashboard',
    '/portal',
    '/staff',
    '/apply',
    '/api',
];

function isNonLocalized(pathname: string): boolean {
    return NON_LOCALIZED_PREFIXES.some(
        prefix => pathname === prefix || pathname.startsWith(`${prefix}/`)
    );
}

function hasLocalePrefix(pathname: string): boolean {
    return ALL_LOCALES.some(
        locale =>
            pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)
    );
}

/** Resolve the visitor's locale: saved cookie → Accept-Language → default. */
function resolveLocale(request: NextRequest): string {
    const cookieLocale = request.cookies.get(LOCALE_COOKIE)?.value;
    if (isLocale(cookieLocale)) return cookieLocale;

    const acceptLanguage = request.headers.get('accept-language');
    if (acceptLanguage) {
        const preferred = acceptLanguage
            .split(',')
            .map(part => part.split(';')[0].trim().split('-')[0].toLowerCase());
        const match = preferred.find(isLocale);
        if (match) return match;
    }

    return DEFAULT_LOCALE;
}

/**
 * Optimistic dashboard guard: redirect to /portal only when the session cookie
 * is absent. This is deliberately a cookie-presence check, NOT a backend call.
 *
 * Middleware runs on every dashboard navigation AND every <Link> prefetch. The
 * previous version fetched `/api/auth/get-session` here with no internal API
 * key, so each of those requests counted against BOTH the NestJS per-IP
 * throttle (no key = no bypass) and Better Auth's own per-IP limiter. On
 * `next start` the browser, this middleware, and SSR all reach the backend as
 * one IP (127.0.0.1 locally / one egress IP in prod), so that get-session storm
 * exhausted the shared bucket after a few pages - then a throttled 429 read as
 * "no session" and bounced a logged-in user to /portal, and the /portal login
 * POST hit the same exhausted bucket ("Too Many Requests").
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
    // --- Legacy Cross-Subdomain Logic ---
    // If you stop using Next.js rewrites and move the frontend and backend to the
    // same apex domain (e.g. app.domain.com and api.domain.com), uncomment this:
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

    /*    for (const { name } of request.cookies.getAll()) {
        if (name.includes('session_token') || name.includes('session_data')) {
            response.cookies.delete({ name, path: '/' });
        }
    } */
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Dashboard auth guard (unchanged behaviour).
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        return guardDashboard(request);
    }

    // 2. Legacy auth redirects
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

    // 3. Other non-localized sections (auth, api, onboarding) - pass through.
    if (isNonLocalized(pathname)) {
        return NextResponse.next();
    }

    // 4. Already localized → let it through.
    if (hasLocalePrefix(pathname)) {
        return NextResponse.next();
    }

    // 5. Thank-you page - the ONE public route with no locale prefix (master:
    //    /{destination}/thank-you/{public_ref}, noindex). The page lives under
    //    the [locale] tree, so serve it from the default-locale branch via a
    //    URL-preserving rewrite instead of the locale redirect below.
    if (/^\/[^/]+\/thank-you\/[^/]+$/.test(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
        return NextResponse.rewrite(url);
    }

    // 5b. Cancellation-request page - same contract as the TYP (master 6.4/C1):
    //     the confirmation email links /cancel/{public_ref} with no locale
    //     prefix, served from the default-locale branch via a URL-preserving
    //     rewrite. Tokenized and noindex; it only ever REQUESTS a cancellation.
    if (/^\/cancel\/[^/]+$/.test(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = `/${DEFAULT_LOCALE}${pathname}`;
        return NextResponse.rewrite(url);
    }

    // 6. Public path without a locale → redirect to the locale-prefixed URL.
    const locale = resolveLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? `/${locale}` : `/${locale}${pathname}`;

    const response = NextResponse.redirect(url);
    response.cookies.set(LOCALE_COOKIE, locale, {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
    });

    // Currency is geo-picked on the SAME redirect that picks the locale, so the
    // page that follows already renders in the visitor's currency - no first
    // paint in euros that flips to dollars a beat later. The edge country header
    // is the best signal we get, and here it costs nothing.
    //
    // An existing cookie is never touched: it is either an explicit choice from
    // the footer selector or an earlier geo pick, and both outrank a fresh guess.
    //
    // This only covers visitors who arrive without a locale prefix (`/`, `/curacao`),
    // because the matcher below deliberately excludes already-localized paths.
    // Deep landings straight onto `/en/curacao` are picked up by
    // `CurrencyAutoDetect` in the browser instead.
    if (!isCurrency(request.cookies.get(CURRENCY_COOKIE)?.value)) {
        const currency = currencyFromCountry(
            countryFromHeaders(request.headers),
        );
        if (currency) {
            response.cookies.set(CURRENCY_COOKIE, currency, {
                path: '/',
                maxAge: 60 * 60 * 24 * 365, // 1 year
                sameSite: 'lax',
                secure: process.env.NODE_ENV === 'production',
            });
        }
    }

    return response;
}

export const config = {
    // Run on everything EXCEPT Next internals, files with an extension, and
    // already-localized paths (/en, /en/..., one alternative per locale - keep in
    // sync with ALL_LOCALES; matcher values must be static so the list is spelled
    // out). Localized paths only ever hit the `hasLocalePrefix -> next()`
    // pass-through, so excluding them here is behavior-identical - and it keeps
    // middleware out of the request path on Vercel, where its presence made
    // client-navigation (RSC) requests to on-demand pages get served the cached
    // HTML document instead of the flight payload (= stuck click, then a full
    // browser reload). The `(?:/|$)` guard stops `/enrique-tours` style paths
    // from being mistaken for the `en` locale.
    matcher: [
        '/((?!_next/static|_next/image|favicon.ico|(?:en|nl|de|fr|es|pt|zh)(?:/|$)|.*\\..*).*)',
    ],
};

