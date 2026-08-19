/**
 * Validation for the two Google container IDs the site loads from
 * dashboard-managed settings.
 *
 * WHY THIS IS NOT JUST A TRIM. Both values are interpolated into an INLINE
 * SCRIPT in `components/frontend/tracking/google-tag-manager.tsx`. They are
 * admin-only fields, so this is defence in depth rather than a live hole - but
 * "only an admin can set it" and "safe to concatenate into executable
 * JavaScript" are different claims. A stray apostrophe in a pasted value would
 * otherwise break every page on the site rather than just the tag, and a
 * deliberately crafted value would run.
 *
 * Anything that does not match the shape Google actually issues is treated as
 * NOT CONFIGURED, so a malformed value silently loads nothing instead of
 * emitting broken script.
 *
 * Lives in its own module so it is unit-testable: the component around it is an
 * async Server Component, which this repo deliberately leaves to Playwright
 * (see the note in `vitest.config.ts`).
 */

// NO `u` FLAG, deliberately. With `iu`, Unicode case-folding makes the Kelvin
// sign (U+212A) fold to `k` and the long s (U+017F) to `s`, so `GTM-ABCDK` with a
// Kelvin sign would pass `[A-Z0-9]`. Without `u` it does not. Pinned by a test.

/** `GTM-XXXXXXX` - Tag Manager container. */
const GTM_ID = /^GTM-[A-Z0-9]{4,10}$/i;

/** `G-XXXXXXXXXX` - GA4 Measurement ID. */
const GA4_ID = /^G-[A-Z0-9]{6,15}$/i;

/**
 * NORMALISED TO UPPERCASE, not returned as typed.
 *
 * Google issues both IDs in uppercase and `gtm.js?id=` is fully case-SENSITIVE -
 * `gtm-n5lt88` and `GTM-n5lt88` both 404 where `GTM-N5LT88` returns the
 * container. Accepting a lowercase paste and passing it through was worse than
 * rejecting it: the page emitted a perfectly healthy-looking loader whose fetch
 * 404'd, so GTM never loaded and the ENTIRE `booking_complete` fan-out died
 * silently - Ads conversion, GA4 purchase and Meta Pixel all gone, with the
 * dataLayer push still happening into a container nobody was listening to.
 *
 * Uppercasing rather than rejecting because a wrong-case paste is the common
 * human error and Google never issues a lowercase ID, so there is no real ID this
 * can corrupt.
 */

/** The container ID, uppercased, if well-formed - else null (= not configured). */
export function validGtmId(raw: string | null | undefined): string | null {
    const v = raw?.trim() ?? '';
    return GTM_ID.test(v) ? v.toUpperCase() : null;
}

/** The GA4 Measurement ID, uppercased, if well-formed - else null. */
export function validGa4Id(raw: string | null | undefined): string | null {
    const v = raw?.trim() ?? '';
    return GA4_ID.test(v) ? v.toUpperCase() : null;
}
