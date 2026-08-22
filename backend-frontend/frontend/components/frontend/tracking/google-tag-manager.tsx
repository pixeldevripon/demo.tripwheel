import Script from 'next/script';

import { getPublicSiteSeo } from '@/lib/api/public/settings';
import { buildGoogleTagsSnippet } from '@/lib/tracking/google-tags-snippet';
import { validGa4Id, validGtmId } from '@/lib/tracking/tag-ids';

/**
 * Loads the two Google containers from the dashboard-managed IDs
 * (Settings > SEO, cached under `site-info`):
 *
 *   - **Google Tag Manager** (`googleTagManagerId`) - the fan-out point for the
 *     Google Ads conversion, the GA4 `purchase` event and the Meta Pixel. It
 *     consumes the `booking_complete` event `lib/tracking/booking-complete.ts`
 *     pushes to `window.dataLayer`, which does nothing until this container loads.
 *   - **GA4** (`googleAnalyticsId`) - the base `gtag.js` tag, which is what makes
 *     pageviews and sessions appear in Analytics at all.
 *
 * WHY GA4 IS LOADED HERE AND NOT IN THE CONTAINER. It used to be neither: the
 * dashboard had a "Google Analytics ID" field that nothing on the site read, so
 * filling it in felt like configuring GA4 and did nothing, while GA4 actually
 * depended on a "Google tag" someone had to remember to add inside GTM. One
 * field, one meaning: setting the ID in the dashboard now loads GA4.
 *
 * ⚠️ THE COROLLARY: the GTM container must NOT also contain a "Google tag" /
 * GA4 configuration tag for the same Measurement ID. Two configurations for one
 * property double-count pageviews. The container keeps only the GA4 *event* tag
 * for `purchase` - see `technical-doc/03-implementation/GTM-CONTAINER-SETUP.md`.
 *
 * Both are gated on `NEXT_PUBLIC_ENABLE_TRACKING === 'true'` (master 8.2: prod
 * only; staging also builds NODE_ENV=production, so this explicit flag is the
 * guard), and each additionally on its own ID being configured, so either can
 * load without the other.
 *
 * Note what "GA4 without GTM" actually gets you: PAGEVIEWS ONLY. The `purchase`
 * event, the Ads conversion and the Meta Pixel are all container tags, so a
 * GA4-ID-only configuration looks healthy and reports no conversions at all.
 *
 * Consent (master 8, item 7 - Consent Mode v2, regional defaults): the consent
 * defaults and BOTH loaders live in ONE inline script, in that order, because
 * that is the only way to guarantee the defaults are set before either container
 * can fire. EEA (EU27 + IS/LI/NO) and the UK default to DENIED on all four v2
 * signals; everywhere else defaults to GRANTED. Cookiebot (`blockingmode=auto`,
 * loaded from the layout) then pushes consent UPDATES on the visitor's choice -
 * `wait_for_update: 500` holds tag firing long enough for a stored choice to
 * land. `ads_data_redaction` strips ad click identifiers while ad_storage is
 * denied, so denied EEA traffic still yields modelled conversions.
 */

export async function GoogleTagManager() {
    const trackingEnabled = process.env.NEXT_PUBLIC_ENABLE_TRACKING === 'true';
    if (!trackingEnabled) return null;

    const seo = await getPublicSiteSeo();
    // Validated, not trusted: both values land inside an inline script below.
    const gtmId = validGtmId(seo.googleTagManagerId);
    const ga4Id = validGa4Id(seo.googleAnalyticsId);

    // Nothing configured (or both values malformed) - render nothing at all
    // rather than an empty container that only looks healthy.
    if (!gtmId && !ga4Id) return null;

    return (
        <>
            <Script id='gtm-base' strategy='afterInteractive'>
                {buildGoogleTagsSnippet({ gtmId, ga4Id })}
            </Script>
            {/* Fallback for no-JS crawlers/agents; harmless when JS is on.
                GTM only - gtag.js has no no-script equivalent. */}
            {gtmId && (
                <noscript>
                    <iframe
                        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
                        height='0'
                        width='0'
                        style={{ display: 'none', visibility: 'hidden' }}
                        title='gtm'
                    />
                </noscript>
            )}
        </>
    );
}
