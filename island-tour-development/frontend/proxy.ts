import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    LOCALE_COOKIE,
    isLocale,
} from '@/lib/constants/locales';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

/**
 * Path prefixes that are NOT part of the localized public site - they must
 * never receive a `/{locale}` prefix.
 *
 * Only `/api` remains: the dashboard (and with it `/dashboard`, `/portal`,
 * `/staff`, `/apply`) was extracted to its own app - those legacy paths are
 * handled by LEGACY_DASHBOARD_PREFIXES below instead of being exempted.
 */
// `/bookings` moved UNDER the locale segment (`/{locale}/bookings`) - the bare
// path now goes through the standard locale redirect like any public page.
const NON_LOCALIZED_PREFIXES = ['/api'];

/**
 * Routes that lived here before the dashboard extraction. They no longer
 * exist on this origin; old bookmarks/emails land on the homepage rather
 * than a 404 (operators/staff get the new door URL from their invite/reset
 * emails, which point at the dashboard app).
 */
const LEGACY_DASHBOARD_PREFIXES = ['/dashboard', '/portal', '/staff', '/apply'];

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

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Legacy dashboard-era paths: the dashboard, portal, staff and apply
    //    surfaces moved to their own app - send stragglers to the homepage.
    //    (The old cookie-presence guard and its session-cookie stripping went
    //    with them; this origin no longer reads the Better Auth cookie.)
    if (
        LEGACY_DASHBOARD_PREFIXES.some(
            prefix =>
                pathname === prefix || pathname.startsWith(`${prefix}/`),
        )
    ) {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // 2. Legacy auth redirects. `/login` is the traveler door on this origin
    //    (email + booking reference); the password doors live on the
    //    dashboard app, so their old paths just go home too.
    if (pathname === '/login') {
        return NextResponse.redirect(
            new URL(`/${resolveLocale(request)}/bookings`, request.url),
        );
    }
    if (pathname === '/forgot-password' || pathname === '/reset-password') {
        return NextResponse.redirect(new URL('/', request.url));
    }

    // 3. Other non-localized sections (api) - pass through.
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

    // NO currency cookie is written here. Master 1.3 (locked June 10, 2026):
    // "The locale sets the default; a currency selector in the global footer
    // lets the user override it" - and "IP-based currency localization is
    // roadmap". Geo-picking the currency here wrote the cookie on the very
    // first request, after which the locale default could never apply again,
    // so /en rendered EUR for anyone whose device or IP looked European.
    // The cookie now carries EXACTLY ONE meaning: an explicit footer pick.

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

