import { notFound } from 'next/navigation';

import { WishlistView } from '@/components/frontend/wishlist-view';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const dict = await getDictionary(locale);
    // A wishlist is personal — never index it.
    return { title: dict.wishlist.title, robots: { index: false, follow: false } };
}

/**
 * Wishlist page — `/[locale]/wishlist`. The page chrome is localized server-side;
 * the per-user content is fetched in the client `WishlistView` (it depends on the
 * Better Auth session, so it must not be part of the cached shell).
 */
export default async function WishlistPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    const dict = await getDictionary(locale);

    return (
        <WishlistView
            locale={locale as Locale}
            dict={dict.wishlist}
            cardDict={dict.destination.listings}
            durationDict={dict.search}
        />
    );
}
