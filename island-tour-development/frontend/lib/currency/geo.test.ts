import { describe, expect, it, vi } from 'vitest';

import {
    countryFromHeaders,
    currencyFromCountry,
    currencyFromTimeZone,
    detectBrowserCurrency,
} from './geo';

/**
 * The currency rule is isomorphic on purpose - the proxy runs it against the
 * edge country header, the browser runs it against the clock's time zone - and
 * the whole point of that symmetry is that a shopper is never quoted EUR by the
 * server and shown USD by the footer. These tests pin both halves to the same
 * answers, so a change to one that forgets the other fails here.
 */

function headers(values: Record<string, string>): Headers {
    return new Headers(values);
}

describe('countryFromHeaders', () => {
    it('reads the Vercel header', () => {
        expect(countryFromHeaders(headers({ 'x-vercel-ip-country': 'NL' }))).toBe(
            'NL',
        );
    });

    it('falls back to Cloudflare, then to the generic header', () => {
        expect(countryFromHeaders(headers({ 'cf-ipcountry': 'DE' }))).toBe('DE');
        expect(countryFromHeaders(headers({ 'x-country': 'FR' }))).toBe('FR');
    });

    it('prefers Vercel when several are present', () => {
        expect(
            countryFromHeaders(
                headers({ 'x-vercel-ip-country': 'NL', 'cf-ipcountry': 'US' }),
            ),
        ).toBe('NL');
    });

    it('normalises case and whitespace', () => {
        expect(countryFromHeaders(headers({ 'x-vercel-ip-country': ' nl ' }))).toBe(
            'NL',
        );
    });

    it('rejects `XX` - Cloudflare\'s "could not determine"', () => {
        expect(
            countryFromHeaders(headers({ 'cf-ipcountry': 'XX' })),
        ).toBeUndefined();
    });

    it('rejects `T1` - a Tor exit node, which locates nobody', () => {
        expect(
            countryFromHeaders(headers({ 'cf-ipcountry': 'T1' })),
        ).toBeUndefined();
    });

    it('rejects anything that is not two characters', () => {
        expect(
            countryFromHeaders(headers({ 'x-vercel-ip-country': 'NLD' })),
        ).toBeUndefined();
        expect(
            countryFromHeaders(headers({ 'x-vercel-ip-country': '' })),
        ).toBeUndefined();
    });

    it('returns undefined with no headers at all (local dev)', () => {
        expect(countryFromHeaders(headers({}))).toBeUndefined();
    });

    it('skips an unusable header to reach a usable one further down', () => {
        expect(
            countryFromHeaders(
                headers({ 'x-vercel-ip-country': 'XX', 'cf-ipcountry': 'BE' }),
            ),
        ).toBe('BE');
    });
});

describe('currencyFromCountry', () => {
    it.each(['NL', 'DE', 'FR', 'ES', 'PT', 'IT', 'IE'])(
        'quotes EUR in the eurozone (%s)',
        (code) => {
            expect(currencyFromCountry(code)).toBe('EUR');
        },
    );

    it.each(['GB', 'CH', 'NO', 'IS', 'SE', 'DK', 'PL'])(
        'quotes EUR across the wider European block (%s)',
        (code) => {
            expect(currencyFromCountry(code)).toBe('EUR');
        },
    );

    it.each(['RS', 'BA', 'UA', 'MD', 'XK', 'AL'])(
        'includes the Western Balkans and eastern neighbours (%s)',
        (code) => {
            expect(currencyFromCountry(code)).toBe('EUR');
        },
    );

    it.each(['TR', 'RU'])(
        'excludes %s - geographically European, but prices travel in dollars',
        (code) => {
            expect(currencyFromCountry(code)).toBe('USD');
        },
    );

    it.each(['US', 'CA', 'AU', 'JP', 'BR', 'ZA'])(
        'quotes USD everywhere else (%s)',
        (code) => {
            expect(currencyFromCountry(code)).toBe('USD');
        },
    );

    it.each(['CW', 'SX', 'AW'])(
        'quotes USD in our own launch destinations (%s) - the florin is dollar-pegged',
        (code) => {
            expect(currencyFromCountry(code)).toBe('USD');
        },
    );

    it('is case- and whitespace-insensitive', () => {
        expect(currencyFromCountry(' nl ')).toBe('EUR');
    });

    it('returns undefined rather than guessing on unusable input', () => {
        expect(currencyFromCountry(undefined)).toBeUndefined();
        expect(currencyFromCountry(null)).toBeUndefined();
        expect(currencyFromCountry('')).toBeUndefined();
        expect(currencyFromCountry('NLD')).toBeUndefined();
    });
});

describe('currencyFromTimeZone', () => {
    it('quotes EUR anywhere in the Europe/ tree', () => {
        expect(currencyFromTimeZone('Europe/Amsterdam')).toBe('EUR');
        expect(currencyFromTimeZone('Europe/London')).toBe('EUR');
    });

    it.each([
        'Atlantic/Canary',
        'Atlantic/Madeira',
        'Atlantic/Azores',
        'Atlantic/Reykjavik',
        'Atlantic/Faroe',
        'Africa/Ceuta',
        'Asia/Nicosia',
        'Asia/Famagusta',
    ])('catches %s - a EUR country filed outside Europe/', (zone) => {
        expect(currencyFromTimeZone(zone)).toBe('EUR');
    });

    it('quotes USD elsewhere', () => {
        expect(currencyFromTimeZone('America/New_York')).toBe('USD');
        expect(currencyFromTimeZone('America/Curacao')).toBe('USD');
        expect(currencyFromTimeZone('Asia/Tokyo')).toBe('USD');
    });

    it('returns undefined for a zone with no region, which locates nobody', () => {
        // A locked-down browser reports bare `UTC`. Reading that as
        // "not Europe" would flip a Dutch shopper to dollars.
        expect(currencyFromTimeZone('UTC')).toBeUndefined();
        expect(currencyFromTimeZone('GMT')).toBeUndefined();
        expect(currencyFromTimeZone('')).toBeUndefined();
        expect(currencyFromTimeZone(null)).toBeUndefined();
    });

    it('agrees with the header path for the same location', () => {
        // The isomorphism that keeps SSR and the footer pill in step.
        expect(currencyFromTimeZone('Europe/Amsterdam')).toBe(
            currencyFromCountry('NL'),
        );
        expect(currencyFromTimeZone('America/New_York')).toBe(
            currencyFromCountry('US'),
        );
    });
});

describe('detectBrowserCurrency', () => {
    it('resolves from the browser clock', () => {
        vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
            resolvedOptions: () => ({ timeZone: 'Europe/Berlin' }),
        } as unknown as Intl.DateTimeFormat);

        expect(detectBrowserCurrency()).toBe('EUR');
    });

    it('swallows a throwing Intl rather than breaking first paint', () => {
        vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
            throw new Error('Intl unavailable');
        });

        expect(detectBrowserCurrency()).toBeUndefined();
    });
});
