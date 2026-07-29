import { getPublicSiteSeo } from '@/lib/api/public/settings';
import { getSiteUrl } from '@/lib/seo/site-url';

/**
 * `/robots.txt` as a Route Handler (not the `app/robots.ts` metadata file) so an
 * admin can paste a fully custom body in Settings > SEO > robots.txt and have it
 * served verbatim. With nothing custom set we generate a sensible default that
 * disallows the private / noindex flows and (when `autoGenerateSitemap` is on)
 * advertises the sitemap.
 *
 * Wildcards (`*`) cover the locale-prefixed variants of each private route in one
 * line - honoured by Google and Bing, the crawlers that matter here.
 */

// The private / noindex route families (mirror the `robots: { index: false }`
// pages). Leading `/*/` absorbs the `/{locale}` (and, for thank-you, the
// locale-less `/{destination}`) prefix.
const DISALLOW = [
    '/*/checkout',
    '/*/thank-you',
    '/*/cancel',
    '/*/review',
    '/*/bookings',
    // The traveller account area. It already serves `robots: index:false`, so
    // this is crawl-budget hygiene rather than an indexing fix - but every
    // other private family is listed here and this one was the odd one out.
    '/*/traveller',
    '/*/wishlist',
    '/*/search',
    '/*/manage-cookies',
    '/account',
    '/api/',
];

export async function GET(): Promise<Response> {
    const [seo, siteUrl] = await Promise.all([
        getPublicSiteSeo(),
        getSiteUrl(),
    ]);

    // Verbatim admin override wins outright.
    const custom = seo.robotsTxt?.trim();
    if (custom) {
        return new Response(`${custom}\n`, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
    }

    // `autoGenerateSitemap` is a string flag; treat anything but an explicit
    // 'false'/'0'/'' as enabled (the field defaults empty, and sitemaps are the
    // safe default to advertise).
    const flag = seo.autoGenerateSitemap?.trim().toLowerCase();
    const advertiseSitemap = flag !== 'false' && flag !== '0' && flag !== 'off';

    const lines = [
        'User-agent: *',
        'Allow: /',
        ...DISALLOW.map((path) => `Disallow: ${path}`),
        '',
        ...(advertiseSitemap ? [`Sitemap: ${siteUrl}/sitemap.xml`] : []),
        `Host: ${siteUrl}`,
        '',
    ];

    return new Response(lines.join('\n'), {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
}
