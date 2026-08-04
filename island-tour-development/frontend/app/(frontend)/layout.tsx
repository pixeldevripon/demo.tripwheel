import Script from 'next/script';

import { AttributionCapture } from '@/components/frontend/attribution-capture';
import { JsonLd } from '@/components/frontend/seo/json-ld';
import { GoogleTagManager } from '@/components/frontend/tracking/google-tag-manager';
import {
    getPublicCompanyInfo,
    getPublicSiteInfo,
    getPublicSiteSeo,
    getPublicSocialMedia,
} from '@/lib/api/public/settings';
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from '@/lib/seo/jsonld';
import { getSiteUrl } from '@/lib/seo/site-url';

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
    const [seo, siteInfo, social, company, siteUrl] = await Promise.all([
        getPublicSiteSeo(),
        getPublicSiteInfo(),
        getPublicSocialMedia(),
        getPublicCompanyInfo(),
        getSiteUrl(),
    ]);
    const cookiebotCbid =
        seo.cookiebotCbid || process.env.NEXT_PUBLIC_COOKIEBOT_CBID;

    // Sitewide structured data: brand identity + social profiles, and the
    // sitelinks search box. Name/logo fall back so the graph is always valid.
    const brandName =
        siteInfo.siteName || company.companyName || 'Island Tours';
    const organizationJsonLd = buildOrganizationJsonLd({
        siteUrl,
        name: brandName,
        logo: siteInfo.logo,
        sameAs: [
            social.facebookUrl,
            social.twitterUrl,
            social.instagramUrl,
            social.youtubeUrl,
            social.linkedinUrl,
            social.tiktokUrl,
        ],
        email: company.companyEmail,
        phone: company.companyPhone,
    });
    const webSiteJsonLd = buildWebSiteJsonLd({ siteUrl, name: brandName });

    // overflow-x-clip lets full-viewport (100vw) bleed sections - e.g. the hub
    // Discover banner - sit edge-to-edge without spawning a horizontal scrollbar
    // from the scrollbar-gutter difference. `clip` (not `hidden`) keeps sticky
    // descendants (the trips tab bar) working.
    return (
        <div className='frontend-root min-h-screen overflow-x-clip'>
            <JsonLd data={organizationJsonLd} />
            <JsonLd data={webSiteJsonLd} />
            {cookiebotCbid && (
                <Script
                    id='Cookiebot'
                    src='https://consent.cookiebot.com/uc.js'
                    data-cbid={cookiebotCbid}
                    data-blockingmode='auto'
                    strategy='afterInteractive'
                />
            )}
            {/* GTM container: fans the dataLayer out to GA4 / Ads / Meta Pixel.
                No-ops unless tracking is enabled AND a GTM ID is configured. */}
            <GoogleTagManager />
            {/*   <SmoothScroll /> */}
            {/* Captures ad click ids + UTM from the landing URL for booking
                attribution (master 8.1.6); renders nothing. */}
            <AttributionCapture />
            {children}
        </div>
    );
}

