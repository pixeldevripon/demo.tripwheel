import { notFound } from 'next/navigation';

import { Footer } from '@/components/frontend/footer';
import { Navbar } from '@/components/frontend/navbar/navbar';
import { WishlistProvider } from '@/components/frontend/wishlist-provider';
import { getActiveDestinations } from '@/lib/api/public';
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

    const [dict, destinations] = await Promise.all([
        getDictionary(locale),
        getActiveDestinations(locale),
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
            />
            {/* Cached static shell (Navbar/Footer) prerenders; the page streams in
                as a dynamic hole so request-time routes don't block the shell. */}
            <main className='pt-18 md:pt-20'>{children}</main>
            <Footer locale={locale} dict={dict.footer} />
        </WishlistProvider>
    );
}

