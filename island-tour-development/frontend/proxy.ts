import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
    ALL_LOCALES,
    DEFAULT_LOCALE,
    LOCALE_COOKIE,
    isLocale,
} from '@/lib/constants/locales';

/**
 * Path prefixes that are NOT part of the localized public site - they must
 * never receive a `/{locale}` prefix (admin panel, auth flows, API, onboarding).
 *
 * The login-surfaces group (app/(login)/*) is intentionally locale-free: the
 * traveler surface resolves locale via Accept-Language/cookie without a prefix
 * (spec 2.1), and the operator/admin/apply surfaces are single-locale.
 */
const NON_LOCALIZED_PREFIXES = [
    '/dashboard',
    '/login',
    '/forgot-password',
    '/reset-password',
    '/onboarding',
    '/bookings',
    '/portal',
    '/staff',
    '/apply',
    '/api',
];

function isNonLocalized(pathname: string): boolean {
    return NON_LOCALIZED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    );
}

function hasLocalePrefix(pathname: string): boolean {
    return ALL_LOCALES.some(
        (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
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
            .map((part) => part.split(';')[0].trim().split('-')[0].toLowerCase());
        const match = preferred.find(isLocale);
        if (match) return match;
    }

    return DEFAULT_LOCALE;
}

/** Protect dashboard routes - redirect to /login when there is no valid session. */
async function guardDashboard(request: NextRequest) {
    const backendUrl =
        process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

    try {
        const response = await fetch(`${backendUrl}/api/auth/get-session`, {
            headers: { cookie: request.headers.get('cookie') || '' },
        });
        const sessionData = await response.json();

        if (!sessionData || !sessionData.session) {
            return NextResponse.redirect(new URL('/login', request.url));
        }
        return NextResponse.next();
    } catch (error) {
        console.error('Proxy error:', error);
        return NextResponse.redirect(new URL('/login', request.url));
    }
}

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // 1. Dashboard auth guard (unchanged behaviour).
    if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
        return guardDashboard(request);
    }

    // 2. Other non-localized sections (auth, api, onboarding) - pass through.
    if (isNonLocalized(pathname)) {
        return NextResponse.next();
    }

    // 3. Already localized → let it through.
    if (hasLocalePrefix(pathname)) {
        return NextResponse.next();
    }

    // 4. Public path without a locale → redirect to the locale-prefixed URL.
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
    return response;
}

export const config = {
    // Run on everything except Next internals and files with an extension.
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
