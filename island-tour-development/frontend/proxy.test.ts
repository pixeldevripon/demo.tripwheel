import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { config, proxy } from './proxy';
import { CURRENCY_COOKIE, LOCALE_COOKIE } from '@/lib/constants/locales';

/**
 * The proxy is the first thing every visitor touches, and its decisions are
 * URL-shaped: a wrong branch is a redirect loop, a 404 on a link that went out
 * in an email, or a page served from the wrong locale tree. All of that is pure
 * request-in/response-out, so it is exactly what unit tests are for.
 *
 * The ORDER of the branches is itself load-bearing (a rewrite rule placed after
 * the locale redirect never runs), so several tests below assert not just the
 * outcome but which branch produced it.
 */

const ORIGIN = 'https://islandtours.test';

function req(
    path: string,
    init: { headers?: Record<string, string>; cookies?: Record<string, string> } = {},
): NextRequest {
    const headers = new Headers(init.headers);
    if (init.cookies) {
        headers.set(
            'cookie',
            Object.entries(init.cookies)
                .map(([k, v]) => `${k}=${v}`)
                .join('; '),
        );
    }
    return new NextRequest(new Request(`${ORIGIN}${path}`, { headers }));
}

/** `NextResponse.next()` is signalled by this internal header, not by a status. */
const isPassThrough = (res: Response) => res.headers.has('x-middleware-next');
/** A rewrite keeps the visitor's URL and swaps the served path. */
const rewriteTarget = (res: Response) => res.headers.get('x-middleware-rewrite');

describe('proxy', () => {
    describe('legacy dashboard-era paths', () => {
        it.each(['/dashboard', '/portal', '/staff', '/apply'])(
            'sends %s home rather than 404ing an old bookmark',
            async (path) => {
                const res = await proxy(req(path));
                expect(res.status).toBe(307);
                expect(res.headers.get('location')).toBe(`${ORIGIN}/`);
            },
        );

        it('also catches nested paths under a legacy prefix', async () => {
            const res = await proxy(req('/dashboard/destinations/curacao'));
            expect(res.headers.get('location')).toBe(`${ORIGIN}/`);
        });

        it('does NOT catch a public path that merely starts with the same letters', async () => {
            // `/applications` is not `/apply`. The prefix check must be
            // segment-aware or it eats real tour slugs.
            const res = await proxy(req('/applications'));
            expect(res.headers.get('location')).toBe(`${ORIGIN}/en/applications`);
        });
    });

    describe('legacy auth paths', () => {
        it('sends /login to the traveller door in the resolved locale', async () => {
            const res = await proxy(
                req('/login', { cookies: { [LOCALE_COOKIE]: 'nl' } }),
            );
            expect(res.headers.get('location')).toBe(`${ORIGIN}/nl/bookings`);
        });

        it.each(['/forgot-password', '/reset-password'])(
            'sends %s home - the password doors live on the dashboard app now',
            async (path) => {
                const res = await proxy(req(path));
                expect(res.headers.get('location')).toBe(`${ORIGIN}/`);
            },
        );
    });

    describe('pass-through', () => {
        it('lets /api through untouched', async () => {
            expect(isPassThrough(await proxy(req('/api/traveler-session')))).toBe(
                true,
            );
        });

        it('lets an already-localized path through', async () => {
            expect(isPassThrough(await proxy(req('/nl/curacao')))).toBe(true);
        });

        it('lets a bare locale root through', async () => {
            expect(isPassThrough(await proxy(req('/de')))).toBe(true);
        });

        it('does NOT mistake a slug that starts with a locale code for a locale', async () => {
            // `/enrique-tours` begins with `en`. Treating it as localized would
            // serve it from the wrong tree; the guard is the `/` boundary.
            const res = await proxy(req('/enrique-tours'));
            expect(isPassThrough(res)).toBe(false);
            expect(res.headers.get('location')).toBe(`${ORIGIN}/en/enrique-tours`);
        });
    });

    describe('URL-preserving rewrites (links that ship in email)', () => {
        it('serves the thank-you page from the default-locale branch', async () => {
            const res = await proxy(req('/curacao/thank-you/BK-12345'));
            expect(rewriteTarget(res)).toBe(
                `${ORIGIN}/en/curacao/thank-you/BK-12345`,
            );
        });

        it('serves the cancellation page from the default-locale branch', async () => {
            const res = await proxy(req('/cancel/BK-12345'));
            expect(rewriteTarget(res)).toBe(`${ORIGIN}/en/cancel/BK-12345`);
        });

        it('rewrites the TYP even for a visitor whose locale cookie says otherwise', async () => {
            // The TYP is the ONE public route with no locale prefix. Honouring
            // the cookie here would redirect and change the URL that was
            // printed in the confirmation email.
            const res = await proxy(
                req('/curacao/thank-you/BK-1', {
                    cookies: { [LOCALE_COOKIE]: 'fr' },
                }),
            );
            expect(rewriteTarget(res)).toBe(`${ORIGIN}/en/curacao/thank-you/BK-1`);
        });

        it('does not rewrite a deeper path that only resembles the TYP shape', async () => {
            const res = await proxy(req('/curacao/thank-you/BK-1/extra'));
            expect(rewriteTarget(res)).toBeNull();
        });
    });

    describe('locale resolution on the redirect', () => {
        it('prefers a valid locale cookie', async () => {
            const res = await proxy(
                req('/curacao', { cookies: { [LOCALE_COOKIE]: 'pt' } }),
            );
            expect(res.headers.get('location')).toBe(`${ORIGIN}/pt/curacao`);
        });

        it('ignores an unsupported cookie value and falls through', async () => {
            const res = await proxy(
                req('/curacao', {
                    cookies: { [LOCALE_COOKIE]: 'ja' },
                    headers: { 'accept-language': 'de-DE,de;q=0.9' },
                }),
            );
            expect(res.headers.get('location')).toBe(`${ORIGIN}/de/curacao`);
        });

        it('falls back to Accept-Language, matching on the base tag', async () => {
            const res = await proxy(
                req('/curacao', { headers: { 'accept-language': 'fr-CA,fr;q=0.9' } }),
            );
            expect(res.headers.get('location')).toBe(`${ORIGIN}/fr/curacao`);
        });

        it('picks the first SUPPORTED language, skipping ones we do not serve', async () => {
            const res = await proxy(
                req('/curacao', {
                    headers: { 'accept-language': 'ja,ko;q=0.9,es;q=0.8' },
                }),
            );
            expect(res.headers.get('location')).toBe(`${ORIGIN}/es/curacao`);
        });

        it('defaults to English when nothing matches', async () => {
            const res = await proxy(
                req('/curacao', { headers: { 'accept-language': 'ja,ko;q=0.9' } }),
            );
            expect(res.headers.get('location')).toBe(`${ORIGIN}/en/curacao`);
        });

        it('maps the site root to the bare locale, not `/en/`', async () => {
            const res = await proxy(req('/'));
            expect(res.headers.get('location')).toBe(`${ORIGIN}/en`);
        });

        it('preserves the query string across the redirect', async () => {
            const res = await proxy(req('/search?q=snorkel&page=2'));
            expect(res.headers.get('location')).toBe(
                `${ORIGIN}/en/search?q=snorkel&page=2`,
            );
        });

        it('persists the resolved locale so the next visit skips the redirect', async () => {
            const res = await proxy(req('/curacao'));
            const cookie = res.cookies.get(LOCALE_COOKIE);
            expect(cookie?.value).toBe('en');
            expect(cookie?.sameSite).toBe('lax');
            expect(cookie?.path).toBe('/');
        });
    });

    describe('geo currency pick (rides the same redirect)', () => {
        it('sets EUR for a European edge country', async () => {
            const res = await proxy(
                req('/curacao', { headers: { 'x-vercel-ip-country': 'NL' } }),
            );
            expect(res.cookies.get(CURRENCY_COOKIE)?.value).toBe('EUR');
        });

        it('sets USD for everywhere else', async () => {
            const res = await proxy(
                req('/curacao', { headers: { 'x-vercel-ip-country': 'US' } }),
            );
            expect(res.cookies.get(CURRENCY_COOKIE)?.value).toBe('USD');
        });

        it('never overrides a currency the visitor already has', async () => {
            // The existing value is either an explicit footer choice or an
            // earlier geo pick. Both outrank a fresh guess.
            const res = await proxy(
                req('/curacao', {
                    headers: { 'x-vercel-ip-country': 'NL' },
                    cookies: { [CURRENCY_COOKIE]: 'USD' },
                }),
            );
            expect(res.cookies.get(CURRENCY_COOKIE)).toBeUndefined();
        });

        it('replaces a corrupt currency cookie rather than trusting it', async () => {
            const res = await proxy(
                req('/curacao', {
                    headers: { 'x-vercel-ip-country': 'NL' },
                    cookies: { [CURRENCY_COOKIE]: 'GBP' },
                }),
            );
            expect(res.cookies.get(CURRENCY_COOKIE)?.value).toBe('EUR');
        });

        it('leaves the cookie unset when the edge reports nothing usable', async () => {
            // `XX` is Cloudflare's "unknown". Guessing here would quote a
            // shopper in the wrong currency on no evidence at all.
            const res = await proxy(
                req('/curacao', { headers: { 'cf-ipcountry': 'XX' } }),
            );
            expect(res.cookies.get(CURRENCY_COOKIE)).toBeUndefined();
        });
    });

    describe('matcher', () => {
        // Next compiles a matcher string to a FULL-match regex. Anchoring is
        // not a detail: unanchored, the trailing `.*` matches somewhere in
        // every path and the negative lookahead never gets to veto anything.
        const matcher = new RegExp(`^${config.matcher[0]}$`);

        it.each(['en', 'nl', 'de', 'fr', 'es', 'pt', 'zh'])(
            'excludes the already-localized /%s tree, keeping middleware off the RSC path',
            (locale) => {
                expect(matcher.test(`/${locale}`)).toBe(false);
                expect(matcher.test(`/${locale}/curacao`)).toBe(false);
            },
        );

        it('still runs for a slug that merely starts with a locale code', () => {
            expect(matcher.test('/enrique-tours')).toBe(true);
        });

        it('excludes static assets and anything with a file extension', () => {
            expect(matcher.test('/_next/static/chunk.js')).toBe(false);
            expect(matcher.test('/favicon.ico')).toBe(false);
            expect(matcher.test('/icons/nav-menu.svg')).toBe(false);
        });

        it('still runs for the unlocalized routes that depend on it', () => {
            expect(matcher.test('/')).toBe(true);
            expect(matcher.test('/curacao/thank-you/BK-1')).toBe(true);
            expect(matcher.test('/cancel/BK-1')).toBe(true);
            expect(matcher.test('/login')).toBe(true);
        });
    });
});
