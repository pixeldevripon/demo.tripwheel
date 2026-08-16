import { notFound } from 'next/navigation';

import { Footer } from '@/components/frontend/footer/footer';
import { HtmlLangSync } from '@/components/frontend/html-lang-sync';
import { Navbar } from '@/components/frontend/navbar/navbar';
import { PageTransition } from '@/components/frontend/page-transition';
import { WishlistProvider } from '@/components/frontend/wishlist-provider';
import { getActiveDestinations } from '@/lib/api/public';
import { getPublicSiteInfo } from '@/lib/api/public/settings';
import { ALL_LOCALES, isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';

/** Pre-render the shell for every supported locale. */
export function generateStaticParams() {
    return ALL_LOCALES.map(locale => ({ locale }));
}

export default async function LocaleLayout({
    children,
    modal,
    params,
}: {
    children: React.ReactNode;
    /** The `@modal` parallel slot - null except while an intercepted route
     *  (the operator-conditions overlay) is active. Optional so the generated
     *  route types stay satisfied while `.next/types` regenerates. */
    modal?: React.ReactNode;
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    const [dict, destinations, siteInfo] = await Promise.all([
        getDictionary(locale),
        getActiveDestinations(locale),
        getPublicSiteInfo(),
    ]);

    // Navbar only needs the display name + slug for the island selector.
    const islands = destinations.map(d => ({ name: d.name, slug: d.slug }));

    return (
        // WishlistProvider is a client island; the server-rendered Navbar/main/Footer
        // are passed through as children, so the shell still prerenders. Per-user
        // wishlist state is resolved inside the provider, in the browser.
        <WishlistProvider locale={locale as Locale}>
            {/* Corrects <html lang> to this locale at runtime (root renders a
                static lang="en"; see the component for the SSR constraint). */}
            <HtmlLangSync locale={locale as Locale} />
            {/* Viewport-filling column: short pages (wishlist, status screens)
                stretch `main` so the footer always closes the viewport with no
                dead space below it. */}
            <div className='flex min-h-svh flex-col'>
                <Navbar
                    locale={locale}
                    dict={dict.nav}
                    search={{
                        ...dict.search,
                        // Card meta labels live in the shared listings dictionary.
                        pickupAvailable:
                            dict.destination.listings.pickupAvailable,
                        freeCancellation:
                            dict.destination.listings.freeCancellation,
                        from: dict.destination.listings.from,
                    }}
                    islands={islands}
                    logo={siteInfo.logo}
                    siteName={siteInfo.siteName}
                />
                {/* Cached static shell (Navbar/Footer) prerenders; the page streams in
                    as a dynamic hole so request-time routes don't block the shell.
                    PageTransition adds the sitewide enter animation on client
                    navigations only (first paint stays un-animated for LCP). */}
                <main className='flex-1 pt-16'>
                    <PageTransition>{children}</PageTransition>
                </main>
                <Footer locale={locale} dict={dict.footer} />
            </div>
            {/* Intercepted-route overlay (operator conditions) - renders above
                whatever page the reader navigated from; the URL stays the
                shareable canonical address. */}
            {modal}
        </WishlistProvider>
    );
}

