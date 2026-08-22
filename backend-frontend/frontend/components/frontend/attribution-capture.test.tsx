/**
 * The consent gate itself. Cookiebot's auto-blocking cannot intercept a
 * first-party `document.cookie` write, so this component IS the control - if
 * these tests go green while the gate is broken, an EEA visitor's click id gets
 * stored without consent.
 */
import { render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AttributionCapture } from './attribution-capture';
import { readAttribution } from '@/lib/tracking/attribution';

function resetCookies() {
    for (const row of document.cookie.split('; ')) {
        const name = row.split('=')[0];
        if (name) document.cookie = `${name}=;path=/;max-age=0`;
    }
}

/**
 * Put Cookiebot on the page with a given MARKETING verdict.
 *
 * The other categories are deliberately INVERTED, not copied: a visitor who
 * accepts statistics while refusing marketing must still not be captured, and
 * `marketing` is the only category that legally covers an ad click id. With all
 * three moving together, reading the wrong key (`statistics`, `preferences`)
 * would pass every test in this file.
 */
function mockCookiebot(marketing: boolean, hasResponse = true) {
    window.Cookiebot = {
        hasResponse,
        consent: {
            necessary: true,
            preferences: !marketing,
            statistics: !marketing,
            marketing,
        },
    };
}

function fire(event: string) {
    window.dispatchEvent(new Event(event));
}

describe('AttributionCapture', () => {
    beforeEach(() => {
        resetCookies();
        delete window.Cookiebot;
        window.history.replaceState({}, '', '/curacao?gclid=abc123');
    });

    afterEach(() => {
        delete window.Cookiebot;
    });

    it('stores NOTHING when Cookiebot is absent entirely', async () => {
        // Fails closed. A misconfigured CBID must not silently degrade into
        // capturing everyone. The event is fired deliberately: it forces the
        // consent CHECK to run, so this fails if the gate is ever removed -
        // relying on "no event, so no write" would pass either way.
        render(<AttributionCapture />);
        fire('CookiebotOnConsentReady');
        await waitFor(() => expect(readAttribution()).toBeNull());
    });

    it('stores NOTHING while the visitor has not answered the banner', async () => {
        // Cookiebot resolves consent (all false) before the banner is answered.
        mockCookiebot(false, false);
        render(<AttributionCapture />);
        fire('CookiebotOnConsentReady');
        await waitFor(() => expect(readAttribution()).toBeNull());
    });

    it('stores NOTHING when marketing consent is declined', async () => {
        mockCookiebot(false);
        render(<AttributionCapture />);
        fire('CookiebotOnDecline');
        await waitFor(() => expect(readAttribution()).toBeNull());
    });

    it('captures once marketing consent is already stored (returning visitor)', async () => {
        mockCookiebot(true);
        render(<AttributionCapture />);
        await waitFor(() =>
            expect(readAttribution()).toEqual({ gclid: 'abc123' })
        );
    });

    it('captures the LANDING click id when consent arrives after navigation', async () => {
        // The reason the landing params are snapshotted on mount: by the time
        // someone reads the banner and clicks Accept, the gclid is long gone
        // from the address bar. Losing it here would silently gut attribution
        // for every consenting EEA visitor.
        mockCookiebot(false, false);
        render(<AttributionCapture />);

        window.history.replaceState({}, '', '/curacao/some-tour'); // navigated on
        mockCookiebot(true);
        fire('CookiebotOnAccept');

        await waitFor(() =>
            expect(readAttribution()).toEqual({ gclid: 'abc123' })
        );
    });

    it('CLEARS a stored click id when consent is later withdrawn', async () => {
        mockCookiebot(true);
        const { rerender } = render(<AttributionCapture />);
        await waitFor(() =>
            expect(readAttribution()).toEqual({ gclid: 'abc123' })
        );

        // Visitor reopens the preference centre and turns marketing off.
        mockCookiebot(false);
        fire('CookiebotOnDecline');
        rerender(<AttributionCapture />);

        // Withdrawal must delete what was stored, not merely stop adding to it.
        await waitFor(() => expect(readAttribution()).toBeNull());
    });

    it('captures when only ConsentReady fires (Cookiebot resolved after mount)', async () => {
        // The NORMAL ordering: Cookiebot loads `afterInteractive`, so the effect
        // usually runs first and ConsentReady is the only signal that reaches a
        // consenting visitor. `hasResponse: false` at mount denies the fallback
        // so this test pins the listener itself - without it, dropping
        // ConsentReady from COOKIEBOT_EVENTS goes unnoticed.
        mockCookiebot(false, false);
        render(<AttributionCapture />);

        mockCookiebot(true);
        fire('CookiebotOnConsentReady');

        await waitFor(() =>
            expect(readAttribution()).toEqual({ gclid: 'abc123' })
        );
    });

    it('captures a consenting visitor whose verdict is set before hasResponse is', async () => {
        // Cookiebot implied-consent configurations, and orderings where
        // ConsentReady fired before these listeners attached. Nothing else is
        // coming, so keying the fallback purely on `hasResponse` would silently
        // cost a CONSENTING visitor their attribution.
        window.Cookiebot = {
            hasResponse: false,
            consent: {
                necessary: true,
                preferences: false,
                statistics: false,
                marketing: true,
            },
        };
        render(<AttributionCapture />);

        await waitFor(() =>
            expect(readAttribution()).toEqual({ gclid: 'abc123' })
        );
    });

    it('purges a pre-consent-gate cookie even when Cookiebot never loads', async () => {
        // The migration case, and the one the gate cannot reach: the old build
        // wrote `it.attribution` for everyone with a 90-day life. If Cookiebot
        // is blocked (ad blocker, CSP, unset CBID) no event ever fires, so the
        // purge must be unconditional or that click id still ships at checkout.
        document.cookie = `it.attribution=${encodeURIComponent(
            JSON.stringify({ gclid: 'legacy-pre-consent' })
        )};path=/`;

        render(<AttributionCapture />); // no window.Cookiebot at all

        await waitFor(() =>
            expect(document.cookie).not.toContain('it.attribution=')
        );
        expect(readAttribution()).toBeNull();
    });

    it('stops listening after unmount', async () => {
        mockCookiebot(false, false);
        const { unmount } = render(<AttributionCapture />);
        unmount();

        mockCookiebot(true);
        fire('CookiebotOnAccept');
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(readAttribution()).toBeNull();
    });

    it('renders nothing', () => {
        mockCookiebot(true);
        const { container } = render(<AttributionCapture />);
        expect(container).toBeEmptyDOMElement();
    });
});
