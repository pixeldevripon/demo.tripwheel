import QueryProvider from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
    getPublicSiteInfo,
    getPublicSiteSeo,
} from '@/lib/api/public/settings';
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
    const [site, seo] = await Promise.all([
        getPublicSiteInfo(),
        getPublicSiteSeo(),
    ]);

    const title = seo.metaTitle ?? site.siteName ?? 'Island Tours';
    const description =
        seo.metaDescription ?? site.siteTagline ?? undefined;

    // canonicalUrl doubles as the metadataBase so relative OG images resolve.
    let metadataBase: URL | undefined;
    try {
        if (seo.canonicalUrl) metadataBase = new URL(seo.canonicalUrl);
    } catch {
        // Malformed admin input - fall back to Next's default resolution.
    }

    // Admins sometimes paste Google's full <meta> tag instead of just the
    // token - accept both by extracting the content value when present.
    const googleVerification =
        seo.googleSearchConsole?.match(/content=["']([^"']+)["']/)?.[1] ??
        seo.googleSearchConsole?.trim();

    return {
        title,
        description,
        ...(seo.metaKeywords ? { keywords: seo.metaKeywords } : {}),
        ...(seo.robotsMeta ? { robots: seo.robotsMeta } : {}),
        ...(metadataBase ? { metadataBase } : {}),
        // Search Console ownership proof: renders the
        // <meta name="google-site-verification"> tag site-wide.
        ...(googleVerification
            ? { verification: { google: googleVerification } }
            : {}),
        // Dashboard-managed favicon; the static app/favicon.ico remains the
        // fallback when none is configured.
        ...(site.favicon ? { icons: { icon: site.favicon } } : {}),
        openGraph: {
            title: seo.ogTitle ?? title,
            description: seo.ogDescription ?? description,
            ...(seo.ogImage ? { images: [seo.ogImage] } : {}),
        },
        twitter: {
            card: seo.twitterImage ? 'summary_large_image' : 'summary',
            title: seo.twitterTitle ?? seo.ogTitle ?? title,
            description:
                seo.twitterDescription ?? seo.ogDescription ?? description,
            ...(seo.twitterImage ? { images: [seo.twitterImage] } : {}),
        },
    };
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

