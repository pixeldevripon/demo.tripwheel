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
 * Consent: the site runs Cookiebot with `data-blockingmode="auto"`, which holds
 * non-essential tags (GTM included) until the visitor consents. Fine-grained
 * consent signalling is a GTM-container concern (Consent Mode), not app code.
 */
export async function GoogleTagManager() {
    const trackingEnabled = process.env.NEXT_PUBLIC_ENABLE_TRACKING === 'true';
    if (!trackingEnabled) return null;

    const seo = await getPublicSiteSeo();
    const gtmId = seo.googleTagManagerId?.trim();
    if (!gtmId) return null;

    return (
        <>
            <Script id='gtm-base' strategy='afterInteractive'>
                {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
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
