'use client';

import { useEffect } from 'react';
import {
    clearAttribution,
    persistAttribution,
    purgeLegacyAttribution,
    readLandingAttribution,
} from '@/lib/tracking/attribution';
import {
    COOKIEBOT_EVENTS,
    marketingConsentGranted,
} from '@/lib/tracking/cookiebot';

/**
 * Captures ad click ids + UTM params from the landing URL into a first-party
 * cookie (master 8.1 item 6), so they survive the funnel and reach the reserve
 * payload. Mounted once in the (frontend) layout; renders nothing.
 *
 * ## Consent
 *
 * The cookie is written ONLY once Cookiebot reports marketing consent. This has
 * to be enforced here, in our own code: Cookiebot's `data-blockingmode="auto"`
 * works by holding back third-party <script> tags, and it cannot intercept a
 * first-party `document.cookie` write. Before this gate existed the click id was
 * stored for every visitor, including EEA visitors who had not answered the
 * banner yet - which is precisely what Consent Mode v2 is there to prevent.
 *
 * Fails closed: no Cookiebot on the page means no capture, ever. Losing
 * attribution for a decliner is the intended outcome, not a regression.
 *
 * ## Why the landing params are snapshotted before the gate
 *
 * Click ids exist on the LANDING url and nowhere else. A visitor reads the
 * banner, clicks around, and only then accepts - by which point the gclid is
 * long gone from the address bar. So the params are read into a local variable
 * on mount (memory is not storage, and needs no consent) and persisted later if
 * and when consent arrives. The layout keeps this component mounted across
 * client-side navigation WITHIN `(frontend)`, so the snapshot survives that. It
 * does NOT survive a full document load, nor crossing into the `(login)` group
 * (which owns `/{locale}/bookings` and does not mount this component) - either
 * remounts against a URL that no longer carries the click id. Accepted: stashing
 * the pending snapshot anywhere durable would itself be storage, needing the
 * very consent we are waiting for. In practice the banner is answered on the
 * landing page, so the loss window is small.
 *
 * ## Why it listens rather than checking once
 *
 * `CookiebotOnConsentReady` fires on every load once the verdict is known,
 * including for a returning visitor with a stored choice; Accept/Decline fire on
 * a fresh answer AND when someone changes their mind via `Cookiebot.renew()`.
 * Subscribing to all three means a withdrawal actively CLEARS the cookie rather
 * than just stopping future writes.
 */
export function AttributionCapture() {
    useEffect(() => {
        // Orphan any cookie the pre-gate build wrote, before anything else and
        // regardless of Cookiebot. The gate stops new writes but cannot reach a
        // cookie that already exists, and the clear path below only runs when
        // Cookiebot is present - which is precisely what an ad blocker or an
        // unset CBID removes. Without this, a pre-consent click id would sit in
        // the jar for 90 days and still be read at checkout.
        purgeLegacyAttribution();

        // Snapshot immediately - this is the only moment the click ids exist.
        const landing = readLandingAttribution();

        const apply = () => {
            if (marketingConsentGranted()) persistAttribution(landing);
            else clearAttribution();
        };

        // A returning visitor may already have a stored verdict by the time this
        // effect runs, in which case no event is coming - act on it now.
        //
        // The `|| marketingConsentGranted()` half covers consent that is already
        // true while `hasResponse` is not yet stamped (Cookiebot's implied-consent
        // configurations, or a ConsentReady that fired before these listeners
        // attached). Without it that visitor consents and captures nothing.
        //
        // Do NOT widen this to `if (window.Cookiebot?.consent)`. During script
        // init the verdict can be momentarily all-false, and `apply()` would then
        // CLEAR a returning consented visitor's cookie - which the follow-up
        // ConsentReady cannot undo, because `landing` is empty on an organic load
        // and `persistAttribution({})` is a deliberate no-op.
        if (window.Cookiebot?.hasResponse || marketingConsentGranted()) apply();

        for (const event of COOKIEBOT_EVENTS) {
            window.addEventListener(event, apply);
        }
        return () => {
            for (const event of COOKIEBOT_EVENTS) {
                window.removeEventListener(event, apply);
            }
        };
    }, []);

    return null;
}
