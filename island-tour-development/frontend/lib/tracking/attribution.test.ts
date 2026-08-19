/**
 * Attribution capture is the one place the site writes a marketing cookie from
 * its own code, so Cookiebot's auto-blocking cannot police it. These tests pin
 * the consent gate itself, plus the merge/last-click-wins semantics the booking
 * record depends on.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    clearAttribution,
    persistAttribution,
    readAttribution,
    readLandingAttribution,
} from './attribution';

const COOKIE = 'it.attribution.v2';

/** Wipe every cookie jsdom is holding between tests. */
function resetCookies() {
    for (const row of document.cookie.split('; ')) {
        const name = row.split('=')[0];
        if (name) document.cookie = `${name}=;path=/;max-age=0`;
    }
}

function setUrl(search: string) {
    window.history.replaceState({}, '', `/curacao${search}`);
}

describe('readLandingAttribution', () => {
    beforeEach(() => {
        resetCookies();
        setUrl('');
    });

    it('reads every click id and utm param off the URL', () => {
        setUrl(
            '?gclid=abc&gbraid=g1&wbraid=w1&fbclid=fb1' +
                '&utm_source=google&utm_medium=cpc&utm_campaign=summer' +
                '&utm_term=boat&utm_content=v2'
        );

        expect(readLandingAttribution()).toEqual({
            gclid: 'abc',
            gbraid: 'g1',
            wbraid: 'w1',
            fbclid: 'fb1',
            utmSource: 'google',
            utmMedium: 'cpc',
            utmCampaign: 'summer',
            utmTerm: 'boat',
            utmContent: 'v2',
        });
    });

    it('returns an empty object on an organic URL', () => {
        setUrl('?foo=bar');
        expect(readLandingAttribution()).toEqual({});
    });

    it('WRITES NOTHING - reading the URL must not store anything', () => {
        // The whole point of the split: this runs before consent is known.
        setUrl('?gclid=abc');
        readLandingAttribution();
        expect(document.cookie).not.toContain(COOKIE);
        expect(readAttribution()).toBeNull();
    });

    it('caps click ids at 512 and utm params at 255 characters', () => {
        setUrl(`?gclid=${'a'.repeat(600)}&utm_source=${'b'.repeat(300)}`);
        const out = readLandingAttribution();
        expect(out.gclid).toHaveLength(512);
        expect(out.utmSource).toHaveLength(255);
    });
});

describe('persistAttribution', () => {
    beforeEach(() => {
        resetCookies();
        setUrl('');
    });

    it('stores what it is given', () => {
        persistAttribution({ gclid: 'abc', utmSource: 'google' });
        expect(readAttribution()).toEqual({ gclid: 'abc', utmSource: 'google' });
    });

    it('merges over the existing cookie - last click wins per param, older params survive', () => {
        persistAttribution({ gclid: 'first', utmCampaign: 'spring' });
        persistAttribution({ gclid: 'second' });

        // A fresh ad click overwrites its own gclid but must not wipe the
        // campaign captured earlier in the funnel.
        expect(readAttribution()).toEqual({
            gclid: 'second',
            utmCampaign: 'spring',
        });
    });

    it('is a no-op when there is nothing new - an organic load never clears a stored click id', () => {
        persistAttribution({ gclid: 'abc' });
        persistAttribution({});
        expect(readAttribution()).toEqual({ gclid: 'abc' });
    });

    it('writes path, the 90-day max-age and samesite=lax', () => {
        // jsdom's cookie getter hides attributes, so assert on the setter.
        // Shortening the window or dropping samesite would otherwise go green.
        const set = vi.spyOn(document, 'cookie', 'set');
        persistAttribution({ gclid: 'abc' });
        expect(set.mock.calls[0][0]).toContain(
            ';path=/;max-age=7776000;samesite=lax'
        );
        set.mockRestore();
    });

    it('omits `secure` on http so local dev still works', () => {
        const set = vi.spyOn(document, 'cookie', 'set');
        persistAttribution({ gclid: 'abc' });
        expect(set.mock.calls[0][0]).not.toContain('secure');
        set.mockRestore();
    });

    it('sets `secure` on https so the cookie never rides a plaintext request', () => {
        // jsdom's `location` is not redefinable, so stub the global rather than
        // the property. Unconditional `secure` would silently break http dev,
        // which is why the flag is conditional and why both halves are pinned.
        const set = vi.spyOn(document, 'cookie', 'set');
        vi.stubGlobal('location', { ...window.location, protocol: 'https:' });

        persistAttribution({ gclid: 'def' });
        expect(set.mock.calls[0][0]).toContain(';secure');

        vi.unstubAllGlobals();
        set.mockRestore();
    });
});

describe('cookie sanitisation on read', () => {
    beforeEach(() => {
        resetCookies();
        setUrl('');
    });

    /** Write a raw value under the real cookie name, bypassing persistAttribution. */
    function plant(value: unknown) {
        document.cookie = `it.attribution.v2=${encodeURIComponent(
            JSON.stringify(value)
        )};path=/`;
    }

    it('drops keys that are not part of the attribution contract', () => {
        // A cookie is matched on (name, domain, path), so a sibling subdomain
        // can plant a Domain-scoped duplicate that a host-only delete misses.
        // Unknown keys must never be merged forward and POSTed to /reserve,
        // where forbidNonWhitelisted would 400 every booking attempt.
        plant({ gclid: 'abc', evil: 'payload', __proto__: { polluted: true } });

        expect(readAttribution()).toEqual({ gclid: 'abc' });
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });

    it('re-applies the length caps to values already in the jar', () => {
        plant({ gclid: 'a'.repeat(900), utmSource: 'b'.repeat(400) });
        const stored = readAttribution();
        expect(stored?.gclid).toHaveLength(512);
        expect(stored?.utmSource).toHaveLength(255);
    });

    it('ignores non-string and empty values', () => {
        plant({ gclid: 123, fbclid: '', wbraid: null, gbraid: 'ok' });
        expect(readAttribution()).toEqual({ gbraid: 'ok' });
    });

    it('survives a corrupt cookie without throwing', () => {
        document.cookie = 'it.attribution.v2=not-json;path=/';
        expect(() => readAttribution()).not.toThrow();
        expect(readAttribution()).toBeNull();
    });

    it('never reads the legacy pre-consent cookie name', () => {
        document.cookie = `it.attribution=${encodeURIComponent(
            JSON.stringify({ gclid: 'legacy' })
        )};path=/`;
        expect(readAttribution()).toBeNull();
    });
});

describe('clearAttribution', () => {
    beforeEach(() => {
        resetCookies();
        setUrl('');
    });

    it('removes a previously stored cookie', () => {
        // Withdrawing consent has to delete what was already stored, not merely
        // stop adding to it.
        persistAttribution({ gclid: 'abc' });
        expect(readAttribution()).not.toBeNull();

        clearAttribution();
        expect(readAttribution()).toBeNull();
    });

    it('is safe to call when nothing was stored', () => {
        expect(() => clearAttribution()).not.toThrow();
        expect(readAttribution()).toBeNull();
    });
});
