import Script from 'next/script';

import { AttributionCapture } from '@/components/frontend/attribution-capture';
import { SmoothScroll } from '@/components/frontend/smooth-scroll';
import { getPublicSiteSeo } from '@/lib/api/public/settings';

export default async function FrontendLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // Cookiebot domain group ID: dashboard-managed (Settings > SEO & Tracking,
    // cached under `site-info` so a save applies without a redeploy), with the
    // env var as a local-dev fallback. Consent posture is Option A (Cookiebot
    // handover): banner for all visitors, auto-blocking holds everything
    // non-essential until consent. The script only renders once a CBID is
    // configured; the Manage Cookies page/footer link then reopen the dialog
    // via Cookiebot.renew().
    const seo = await getPublicSiteSeo();
    const cookiebotCbid =
        seo.cookiebotCbid || process.env.NEXT_PUBLIC_COOKIEBOT_CBID;

    // overflow-x-clip lets full-viewport (100vw) bleed sections - e.g. the hub
    // Discover banner - sit edge-to-edge without spawning a horizontal scrollbar
    // from the scrollbar-gutter difference. `clip` (not `hidden`) keeps sticky
    // descendants (the trips tab bar) working.
    return (
        <div className='frontend-root min-h-screen overflow-x-clip'>
            {cookiebotCbid && (
                <Script
                    id='Cookiebot'
                    src='https://consent.cookiebot.com/uc.js'
                    data-cbid={cookiebotCbid}
                    data-blockingmode='auto'
                    strategy='afterInteractive'
                />
            )}
            {/*   <SmoothScroll /> */}
            {/* Captures ad click ids + UTM from the landing URL for booking
                attribution (master 8.1.6); renders nothing. */}
            <AttributionCapture />
            {children}
        </div>
    );
}

