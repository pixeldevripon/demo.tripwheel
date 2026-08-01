import { CustomScripts } from '@/components/frontend/tracking/custom-scripts';
import QueryProvider from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
    getPublicSiteInfo,
    getPublicSiteSeo,
    getPublicSocialMedia,
} from '@/lib/api/public/settings';
import { getSiteUrl } from '@/lib/seo/site-url';
import { cn } from '@/lib/utils';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import {
    Bricolage_Grotesque,
    JetBrains_Mono,
    Source_Sans_3,
} from 'next/font/google';
import './globals.css';

/**
 * The site's brand fonts (design v2 contract, technical-doc/homepage):
 * Bricolage Grotesque for display/headings, Source Sans 3 for body copy.
 * Both are variable fonts self-hosted by next/font, exposed as CSS variables
 * that `globals.css` / `frontend-tokens.css` fold into the `--it-font-*`
 * stacks (system SF Pro remains the fallback while they load).
 *
 * JetBrains Mono stays because it IS painted - `font-mono` renders the booking
 * references in the traveller account area (`traveller-booking-card.tsx`,
 * `traveller-payments-list.tsx`).
 */
const bricolage = Bricolage_Grotesque({
    variable: '--font-bricolage',
    subsets: ['latin', 'latin-ext'],
});

const sourceSans = Source_Sans_3({
    variable: '--font-source-sans',
    subsets: ['latin', 'latin-ext'],
});

const jetbrainsMono = JetBrains_Mono({
    variable: '--font-jetbrains-mono',
    subsets: ['latin'],
});

/**
 * Site-wide defaults sourced from the admin-managed settings (Settings > SEO
 * and Settings > General in the dashboard). Both reads are cached under the
 * `site-info` tag, so a dashboard save shows up without a redeploy. Pages with
 * their own generateMetadata (tour/search/wishlist) still override these.
 */
export async function generateMetadata(): Promise<Metadata> {
    const [site, seo, social, siteUrl] = await Promise.all([
        getPublicSiteInfo(),
        getPublicSiteSeo(),
        getPublicSocialMedia(),
        getSiteUrl(),
    ]);

    const title = seo.metaTitle ?? site.siteName ?? 'Island Tours';
    const description = seo.metaDescription ?? site.siteTagline ?? undefined;
    const siteName = site.siteName ?? 'Island Tours';

    // `getSiteUrl` is never empty (canonicalUrl -> NEXT_PUBLIC_SITE_URL -> launch
    // domain), so metadataBase is always a valid absolute origin and relative
    // OG/canonical URLs never fall back to localhost in production.
    const metadataBase = new URL(siteUrl);

    // Admins sometimes paste Google's full <meta> tag instead of just the
    // token - accept both by extracting the content value when present.
    const googleVerification =
        seo.googleSearchConsole?.match(/content=["']([^"']+)["']/)?.[1] ??
        seo.googleSearchConsole?.trim();

    // Twitter handle from the social profile URL (twitter.com/x.com), as
    // `@handle` - powers twitter:site / twitter:creator.
    const twitterHandle = extractTwitterHandle(social.twitterUrl);

    return {
        title,
        description,
        ...(seo.metaKeywords ? { keywords: seo.metaKeywords } : {}),
        ...(seo.robotsMeta ? { robots: seo.robotsMeta } : {}),
        metadataBase,
        // Search Console ownership proof: renders the
        // <meta name="google-site-verification"> tag site-wide.
        ...(googleVerification
            ? { verification: { google: googleVerification } }
            : {}),
        // Dashboard-managed favicon. The static file lives in public/ (NOT
        // app/ - an app/favicon.ico is always auto-injected by Next and
        // browsers prefer it over the dynamic link), so exactly one icon link
        // is emitted: the settings URL, or the bundled fallback.
        icons: { icon: site.favicon || '/favicon.ico' },
        openGraph: {
            type: 'website',
            siteName,
            url: siteUrl,
            title: seo.ogTitle ?? title,
            description: seo.ogDescription ?? description,
            ...(seo.ogImage ? { images: [seo.ogImage] } : {}),
        },
        twitter: {
            card: seo.twitterImage ? 'summary_large_image' : 'summary',
            // Title/description are set ONLY when the admin authored a
            // Twitter-specific value. They used to fall back to the sitewide
            // `ogTitle ?? title`, which silently shadowed every page: Next
            // merges `twitter` shallowly and no page sets a `twitter` key, so
            // a shared tour link showed the generic site copy while og:title
            // correctly showed the tour. Omitting them lets Next derive
            // twitter:title/description from each page's own metadata, and an
            // explicit admin value still wins where one exists.
            ...(seo.twitterTitle ? { title: seo.twitterTitle } : {}),
            ...(seo.twitterDescription
                ? { description: seo.twitterDescription }
                : {}),
            ...(twitterHandle
                ? { site: twitterHandle, creator: twitterHandle }
                : {}),
            ...(seo.twitterImage ? { images: [seo.twitterImage] } : {}),
        },
    };
}

/** `https://x.com/tripwheel` (or twitter.com) -> `@tripwheel`; null otherwise. */
function extractTwitterHandle(url: string | null): string | null {
    if (!url) return null;
    try {
        const { hostname, pathname } = new URL(url);
        if (!/(^|\.)(twitter|x)\.com$/.test(hostname)) return null;
        const handle = pathname.split('/').filter(Boolean)[0];
        return handle ? `@${handle.replace(/^@/, '')}` : null;
    } catch {
        return null;
    }
}

/**
 * The admin-managed custom scripts (Settings > Scripts) mount HERE, in the ROOT
 * layout, and the explicit `<head>` below is deliberate.
 *
 * React only hoists SOME tags into the head on its own (`<meta>`, `<link>`,
 * async `<script src>`). An inline `<script>` or a `<style>` is not hoisted, so
 * without a real `<head>` element a snippet saved as "Header" landed at the top
 * of `<body>` instead. That still executed before any content, but "Header"
 * should mean the head, and a vendor whose install page says "paste this in
 * <head>" should get exactly that. Verified: with this `<head>`, an inline
 * script and a `<style>` both render inside it, and `<title>`, `og:*` and the
 * meta description from `generateMetadata` are all still emitted correctly.
 *
 * The Next docs say not to hand-write `<head>` for METADATA - that is what the
 * Metadata API above is for, and nothing here bypasses it. This element carries
 * only admin-pasted vendor markup, which the Metadata API has no concept of.
 *
 * Both blocks must stay in the ROOT layout: it renders once per document and is
 * not re-rendered on soft navigation, so each snippet executes exactly once,
 * which is what every analytics vendor assumes. Moving either into a route group
 * breaks that silently.
 */
export default function RootLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return (
        <html
            lang='en'
            suppressHydrationWarning
            className={cn(
                'h-full antialiased',
                bricolage.variable,
                sourceSans.variable,
                jetbrainsMono.variable,
                'font-sans'
            )}>
            <head>
                <CustomScripts position='head' />
            </head>
            <body suppressHydrationWarning className='min-h-full flex flex-col'>
                <QueryProvider>
                    <ThemeProvider
                        attribute='class'
                        defaultTheme='system'
                        enableSystem
                        disableTransitionOnChange>
                        <TooltipProvider delayDuration={300}>
                            {children}
                            <Toaster richColors  />
                        </TooltipProvider>
                    </ThemeProvider>
                </QueryProvider>
                <CustomScripts position='bodyEnd' />
            </body>
        </html>
    );
}

