/**
 * The ONE declaration of the Cookiebot browser API, plus the helpers around it.
 *
 * Single source on purpose: TypeScript MERGES `declare global` blocks across
 * files, so two files describing `window.Cookiebot` with different shapes is a
 * compile error ("subsequent property declarations must have the same type").
 * Every consumer imports from here instead of re-declaring.
 *
 * Cookiebot is loaded in `app/(frontend)/layout.tsx` with
 * `data-blockingmode="auto"`, and only when a CBID is configured. So on a
 * misconfigured or local environment `window.Cookiebot` is simply absent - every
 * helper here treats that as "no consent", never as "assume yes".
 */

/** The consent categories Cookiebot exposes. We only ever read `marketing`. */
export interface CookiebotConsent {
    necessary: boolean;
    preferences: boolean;
    statistics: boolean;
    marketing: boolean;
}

declare global {
    interface Window {
        Cookiebot?: {
            /** Reopens the preference centre (used by the Manage Cookies page). */
            renew?: () => void;
            /** Per-category verdict. Absent until the script has initialised. */
            consent?: CookiebotConsent;
            /** True once the visitor has actually answered the banner. */
            hasResponse?: boolean;
        };
    }
}

/**
 * Events Cookiebot dispatches on `window`.
 *
 * `ConsentReady` fires on EVERY page load once the verdict is known - including
 * for a returning visitor whose choice was already stored - which is what makes
 * it the right signal to subscribe to. `Accept`/`Decline` fire on a fresh
 * interaction with the banner, and also when someone changes their mind via
 * `Cookiebot.renew()`, so a withdrawal is caught too.
 */
export const COOKIEBOT_EVENTS = [
    'CookiebotOnConsentReady',
    'CookiebotOnAccept',
    'CookiebotOnDecline',
] as const;

/**
 * Has the visitor granted MARKETING consent?
 *
 * Fails closed. No Cookiebot on the page (not configured, blocked, still
 * loading) means `false` - we would rather lose attribution than store an ad
 * click id for someone who never agreed to it.
 */
export function marketingConsentGranted(): boolean {
    if (typeof window === 'undefined') return false;
    return window.Cookiebot?.consent?.marketing === true;
}
