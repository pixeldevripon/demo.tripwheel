/**
 * Public site settings (server-side, cached). Backs the brand logo and every
 * WhatsApp surface on the public site.
 *
 * Hits `GET /settings/public/site`, the unauthenticated projection of SiteInfo:
 * logo, favicon, tagline, and the WhatsApp/Instagram flags. The dashboard's
 * `GET /settings/site` requires VIEW_SETTINGS and returns the whole row - never
 * call that one from the public site.
 */
import 'server-only';

import { cacheLife, cacheTag } from 'next/cache';

import { publicGet } from './fetch';

export interface PublicSiteInfo {
    siteName: string | null;
    siteTagline: string | null;
    logo: string | null;
    favicon: string | null;
    enableWhatsappChat: boolean;
    /** Null whenever `enableWhatsappChat` is false - the backend nulls it. */
    whatsappNumber: string | null;
    /**
     * Kill switch for the Instagram grid. The tiles themselves come from
     * `getInstagramFeed`, which applies this same flag - so a section only has
     * to check `feed.enabled`.
     */
    enableInstagram: boolean;
    /**
     * "Your local host" - the looping avatar beside the WhatsApp button in the
     * FAQ block. Site-wide rather than homepage content because that block
     * renders on the home, destination and collection pages. Null on either
     * keeps the bundled avatar.
     */
    faqHostImage: string | null;
    faqHostVideo: string | null;
}

/**
 * Settings an admin changes rarely but expects to see live. `cacheLife('days')`
 * with the `site-info` tag: a Settings > General save in the dashboard POSTs the
 * tag to `app/api/revalidate/route.ts` (mapped by that repo's
 * lib/api/cache-revalidation.ts), so the long window costs nothing in staleness.
 *
 * Falls back to WhatsApp/Instagram disabled if the backend is unreachable, so a
 * settings outage degrades to "no chat button" rather than a broken page.
 */
export async function getPublicSiteInfo(): Promise<PublicSiteInfo> {
    'use cache';
    cacheLife('days');
    cacheTag('site-info');

    const res = await publicGet<PublicSiteInfo>('/settings/public/site');

    return (
        res ?? {
            siteName: null,
            siteTagline: null,
            logo: null,
            favicon: null,
            enableWhatsappChat: false,
            whatsappNumber: null,
            enableInstagram: false,
            faqHostImage: null,
            faqHostVideo: null,
        }
    );
}

/** Public-safe SiteSEO projection: meta/OG/Twitter tag values only. */
export interface PublicSiteSeo {
    metaTitle: string | null;
    metaDescription: string | null;
    metaKeywords: string | null;
    canonicalUrl: string | null;
    robotsMeta: string | null;
    ogTitle: string | null;
    ogDescription: string | null;
    ogImage: string | null;
    twitterTitle: string | null;
    twitterDescription: string | null;
    twitterImage: string | null;
    /** GA4 measurement ID (G-XXXX). Public - ships in the GTM/gtag tag. */
    googleAnalyticsId: string | null;
    /** Google Tag Manager container ID (GTM-XXXX). Loads the GTM container. */
    googleTagManagerId: string | null;
    /** Search Console ownership token - rendered as google-site-verification. */
    googleSearchConsole: string | null;
    /** Meta (Facebook) Pixel ID. Public - ships in the Pixel base code. */
    facebookPixelId: string | null;
    /** Cookiebot domain group ID (data-cbid) - loads the consent banner. */
    cookiebotCbid: string | null;
    /** Custom robots.txt body. When set, served verbatim; else generated. */
    robotsTxt: string | null;
    /** String flag ('true') - whether robots.txt advertises the sitemap. */
    autoGenerateSitemap: string | null;
}

/** The public social profile URLs (footer). */
export interface PublicSocialMedia {
    facebookUrl: string | null;
    twitterUrl: string | null;
    linkedinUrl: string | null;
    instagramUrl: string | null;
    youtubeUrl: string | null;
    tiktokUrl: string | null;
}

/** Public-safe company/legal details (footer, legal pages). */
export interface PublicCompanyInfo {
    companyName: string | null;
    companyEmail: string | null;
    companyPhone: string | null;
    companyWebsite: string | null;
    companyAddress: string | null;
    companyCity: string | null;
    companyState: string | null;
    companyZip: string | null;
    companyCountry: string | null;
    companyVat: string | null;
}

/**
 * Same caching contract as getPublicSiteInfo: all three ride the coarse
 * `site-info` tag, and the dashboard busts it after any settings save that
 * backs a public read (see the dashboard's cache-revalidation mapping).
 * Null-object fallbacks keep an outage to "generic metadata / empty footer
 * links" instead of a broken page.
 */
export async function getPublicSiteSeo(): Promise<PublicSiteSeo> {
    'use cache';
    cacheLife('days');
    cacheTag('site-info');

    const res = await publicGet<PublicSiteSeo>('/settings/public/seo');

    return (
        res ?? {
            metaTitle: null,
            metaDescription: null,
            metaKeywords: null,
            canonicalUrl: null,
            robotsMeta: null,
            ogTitle: null,
            ogDescription: null,
            ogImage: null,
            twitterTitle: null,
            twitterDescription: null,
            twitterImage: null,
            googleAnalyticsId: null,
            googleTagManagerId: null,
            googleSearchConsole: null,
            facebookPixelId: null,
            cookiebotCbid: null,
            robotsTxt: null,
            autoGenerateSitemap: null,
        }
    );
}

export async function getPublicSocialMedia(): Promise<PublicSocialMedia> {
    'use cache';
    cacheLife('days');
    cacheTag('site-info');

    const res = await publicGet<PublicSocialMedia>(
        '/settings/public/social-media',
    );

    return (
        res ?? {
            facebookUrl: null,
            twitterUrl: null,
            linkedinUrl: null,
            instagramUrl: null,
            youtubeUrl: null,
            tiktokUrl: null,
        }
    );
}

export async function getPublicCompanyInfo(): Promise<PublicCompanyInfo> {
    'use cache';
    cacheLife('days');
    cacheTag('site-info');

    const res = await publicGet<PublicCompanyInfo>('/settings/public/company');

    return (
        res ?? {
            companyName: null,
            companyEmail: null,
            companyPhone: null,
            companyWebsite: null,
            companyAddress: null,
            companyCity: null,
            companyState: null,
            companyZip: null,
            companyCountry: null,
            companyVat: null,
        }
    );
}
