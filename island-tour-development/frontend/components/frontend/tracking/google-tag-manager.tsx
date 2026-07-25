import Script from 'next/script';

import { getPublicSiteSeo } from '@/lib/api/public/settings';

/**
 * Loads the Google Tag Manager container from the dashboard-managed GTM ID
 * (Settings > SEO & Tracking, cached under `site-info`). GTM is the single fan-out
 * point for GA4 / Google Ads / Meta Pixel and the server-side container, and it
 * consumes the `booking_complete` event `lib/tracking/booking-complete.ts` already
 * pushes to `window.dataLayer` - which does nothing until this container loads.
 *
 * Gated on BOTH:
 *   - `NEXT_PUBLIC_ENABLE_TRACKING === 'true'` (master 8.2: prod only; staging also
 *     builds NODE_ENV=production, so this explicit flag is the guard), AND
 *   - a configured GTM container ID.
 *
 * Consent (master 8, item 7 - Consent Mode v2, regional defaults): the inline
 * script below sets `gtag('consent','default',...)` BEFORE gtm.js loads - same
 * script, so the ordering is guaranteed. EEA (EU27 + IS/LI/NO) and the UK
 * default to DENIED on all four v2 signals; everywhere else (incl. US/CA)
 * defaults to GRANTED. Cookiebot (`data-blockingmode="auto"`, loaded from the
 * layout) then pushes consent UPDATES on the visitor's choice -
 * `wait_for_update: 500` holds tag firing long enough for a stored choice to
 * land. `ads_data_redaction` strips ad click identifiers while ad_storage is
 * denied, so denied EEA traffic still yields modelled conversions.
 */

/** EEA (EU27 + Iceland/Liechtenstein/Norway) + UK - consent DENIED by default. */
const DENIED_REGIONS = [
    'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR',
    'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK',
    'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB',
];

export async function GoogleTagManager() {
    const trackingEnabled = process.env.NEXT_PUBLIC_ENABLE_TRACKING === 'true';
    if (!trackingEnabled) return null;

    const seo = await getPublicSiteSeo();
    const gtmId = seo.googleTagManagerId?.trim();
    if (!gtmId) return null;

    const consentDefaults = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500,region:${JSON.stringify(DENIED_REGIONS)}});
gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted',wait_for_update:500});
gtag('set','ads_data_redaction',true);`;

    return (
        <>
            <Script id='gtm-base' strategy='afterInteractive'>
                {`${consentDefaults}
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
            </Script>
            {/* Fallback for no-JS crawlers/agents; harmless when JS is on. */}
            <noscript>
                <iframe
                    src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
                    height='0'
                    width='0'
                    style={{ display: 'none', visibility: 'hidden' }}
                    title='gtm'
                />
            </noscript>
        </>
    );
}
