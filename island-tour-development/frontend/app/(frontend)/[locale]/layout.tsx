import { notFound } from 'next/navigation';

import { Footer } from '@/components/frontend/footer/footer';
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
    params,
}: {
    children: React.ReactNode;
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
            <Navbar
                locale={locale}
                dict={dict.nav}
                search={{
                    ...dict.search,
                    // Card meta labels live in the shared listings dictionary.
                    pickupAvailable: dict.destination.listings.pickupAvailable,
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
            <main className='pt-18 md:pt-20'>
                <PageTransition>{children}</PageTransition>
            </main>
            <Footer locale={locale} dict={dict.footer} />
        </WishlistProvider>
    );
}

