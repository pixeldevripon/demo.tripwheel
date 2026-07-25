import 'server-only';

import { getPublicSiteSeo } from '@/lib/api/public/settings';

/**
 * The production public origin, used to absolutize canonical/OG URLs, robots.txt
 * and sitemap.xml. Overridable at build via NEXT_PUBLIC_SITE_URL; the hardcoded
 * default is the launch domain so a missing env never yields localhost in prod.
 */
const FALLBACK_SITE_URL = 'https://www.tripwheel.app';

/** Strip a single trailing slash so callers can always append `/path`. */
function normalizeOrigin(raw: string): string {
    return raw.replace(/\/+$/, '');
}

/**
 * Resolve the site's absolute base URL, in priority order:
 *   1. the admin's Settings > SEO "Canonical URL" (the source of truth the
 *      root `metadataBase` already trusts),
 *   2. the `NEXT_PUBLIC_SITE_URL` env,
 *   3. the hardcoded launch domain.
 *
 * Returns a validated origin with NO trailing slash. Reads the cached SEO
 * settings (tagged `site-info`), so a dashboard save propagates without a
 * redeploy.
 */
export async function getSiteUrl(): Promise<string> {
    const seo = await getPublicSiteSeo();

    const candidate = seo.canonicalUrl || process.env.NEXT_PUBLIC_SITE_URL;
    if (candidate) {
        try {
            return normalizeOrigin(new URL(candidate).toString());
        } catch {
            // Malformed admin/env value - fall through to the launch default.
        }
    }

    return FALLBACK_SITE_URL;
}
