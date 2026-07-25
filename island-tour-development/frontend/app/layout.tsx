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
    DM_Sans,
    JetBrains_Mono,
    Noto_Sans,
    Playfair_Display,
} from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const dmSans = DM_Sans({
    variable: '--font-dm-sans',
    subsets: ['latin'],
    weight: ['400', '500', '600', '700'],
});

const generalSans = localFont({
    variable: '--font-general-sans',
    src: [
        {
            path: './fonts/GeneralSans-Variable.woff2',
            style: 'normal',
        },
        {
            path: './fonts/GeneralSans-VariableItalic.woff2',
            style: 'italic',
        },
    ],
});

const playfairDisplayHeading = Playfair_Display({
    subsets: ['latin'],
    variable: '--font-heading',
});

const notoSans = Noto_Sans({ subsets: ['latin'], variable: '--font-sans' });

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
    const description =
        seo.metaDescription ?? site.siteTagline ?? undefined;
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
            title: seo.twitterTitle ?? seo.ogTitle ?? title,
            description:
                seo.twitterDescription ?? seo.ogDescription ?? description,
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

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html
            lang='en'
            suppressHydrationWarning
            className={cn(
                'h-full antialiased',
                jetbrainsMono.variable,
                dmSans.variable,
                generalSans.variable,
                'font-sans',
                notoSans.variable,
                playfairDisplayHeading.variable
            )}>
            <body suppressHydrationWarning className='min-h-full flex flex-col'>
                <QueryProvider>
                    <ThemeProvider
                        attribute='class'
                        defaultTheme='system'
                        enableSystem
                        disableTransitionOnChange>
                        <TooltipProvider delayDuration={300}>
                            {children}
                            <Toaster richColors />
                        </TooltipProvider>
                    </ThemeProvider>
                </QueryProvider>
            </body>
        </html>
    );
}

