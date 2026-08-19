/**
 * Builds the ONE inline script that boots Google's tags.
 *
 * WHY THIS IS ONE STRING AND NOT THREE SCRIPT TAGS. The whole compliance story
 * rests on an ordering invariant:
 *
 *   1. `dataLayer` exists and `gtag` is DECLARED
 *   2. Consent Mode v2 defaults are set (EEA/UK denied)
 *   3. only then may either container load
 *
 * A classic inline script runs synchronously in source order, so concatenating
 * the three parts is the only arrangement that guarantees it. Separate
 * `<Script>` tags do not guarantee relative execution order, and either loader
 * running before the defaults would let tags fire un-consented in the EEA.
 *
 * Both loaders insert their external script rather than writing it inline, so
 * neither can execute during this script - they run as a later task, by which
 * point the defaults are already in the dataLayer and get replayed to both.
 *
 * Extracted from the component purely so the ordering can be asserted in tests:
 * the component is an async Server Component, which this repo leaves to
 * Playwright (see `vitest.config.ts`). Pass IDs that have already been through
 * `tag-ids.ts` - this function does no validation and interpolates directly.
 */

/** EEA (EU27 + Iceland/Liechtenstein/Norway) + UK - consent DENIED by default. */
export const DENIED_REGIONS = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
    'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB',
];

export function buildGoogleTagsSnippet({
    gtmId,
    ga4Id,
}: {
    gtmId: string | null;
    ga4Id: string | null;
}): string {
    // 1 + 2. Unconditional: the defaults must exist even if only one container
    // is configured, and `gtag` must be declared before the GA4 loader calls it.
    const consentDefaults = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500,region:${JSON.stringify(DENIED_REGIONS)}});
gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted',wait_for_update:500});
gtag('set','ads_data_redaction',true);`;

    // 3a. GTM - the fan-out for the Ads conversion, GA4 `purchase` and the Pixel.
    const gtmLoader = gtmId
        ? `\n(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`
        : '';

    // 3b. GA4 base tag. `gtag('js', <date>)` then `config` is Google's required
    // order, and `config` is what actually activates the property - gtag.js does
    // NOT auto-configure from the `?id=` query parameter, so this is exactly one
    // configuration and therefore exactly one page_view.
    const ga4Loader = ga4Id
        ? `\n(function(d,i){var g=d.createElement('script');g.async=true;g.src='https://www.googletagmanager.com/gtag/js?id='+i;d.head.appendChild(g);gtag('js',new Date());gtag('config',i);})(document,'${ga4Id}');`
        : '';

    return `${consentDefaults}${gtmLoader}${ga4Loader}`;
}
