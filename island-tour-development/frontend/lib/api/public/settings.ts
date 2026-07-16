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
    enableInstagram: boolean;
    instagramWidgetId: string | null;
}

/**
 * Settings an admin changes rarely but expects to see live. `cacheLife('days')`
 * with the `site-info` tag: a Settings > General save fires the revalidation
 * Server Action (see lib/api/cache-revalidation.ts), so the long window costs
 * nothing in staleness.
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
            instagramWidgetId: null,
        }
    );
}
