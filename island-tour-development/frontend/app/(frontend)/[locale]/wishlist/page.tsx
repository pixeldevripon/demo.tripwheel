import { notFound } from 'next/navigation';

import { SavedToursView } from '@/components/frontend/saved/saved-tours-view';
import type { SavedEmptyDestination } from '@/components/frontend/saved/saved-empty-state';
import { ToursTrustStrip } from '@/components/frontend/tours/tours-trust-strip';
import { isLocale, type Locale } from '@/lib/constants/locales';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getDestinationCategories } from '@/lib/api/public/categories';
import { getActiveDestinations } from '@/lib/api/public/destinations';
import { getDestinationTours } from '@/lib/api/public/tours';
import { searchHitToListing } from '@/lib/tours/listing';

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) return {};
    const dict = await getDictionary(locale);
    // A saved list is personal - never index it.
    return { title: dict.wishlist.title, robots: { index: false, follow: false } };
}

/** How many category quick links the empty state offers before it is a menu. */
const EMPTY_STATE_CATEGORIES = 6;
/** Locals' favorites on the empty state - a starter set, not a listing. */
const EMPTY_STATE_FAVOURITES = 3;

/**
 * Everything the empty state needs about one island: the way back, the
 * categories, and three tours with live hearts (master 5.12).
 *
 * Resolved for EVERY active island rather than for one, because which island
 * applies is a localStorage read that only exists after mount. Each piece is
 * `'use cache'`-backed and shared across all visitors, so this is one cached
 * payload per island per hour, not a fetch per page view.
 */
async function emptyStateFor(
    destination: { id: string; slug: string; name: string },
    locale: Locale,
    duration: { hours: string; hour: string; minutes: string; range: string }
): Promise<SavedEmptyDestination> {
    const [categories, favourites] = await Promise.all([
        getDestinationCategories(destination.slug, locale),
        getDestinationTours({
            destinationId: destination.id,
            locale,
            localsFavourite: true,
            sort: 'recommended',
            limit: EMPTY_STATE_FAVOURITES,
        }),
    ]);

    return {
        slug: destination.slug,
        name: destination.name,
        categories: categories
            .slice(0, EMPTY_STATE_CATEGORIES)
            .map(c => ({ slug: c.slug, name: c.name })),
        favourites: favourites.data.map(hit =>
            searchHitToListing(hit, locale, duration)
        ),
    };
}

/**
 * Saved tours - `/[locale]/wishlist`.
 *
 * The route keeps the internal word; nothing a visitor READS does. mck-17 is
 * explicit that "Wishlist" survives only in the GA4 event names
 * (`add_to_wishlist` / `remove_from_wishlist`), so the H1, the nav and every
 * line of copy say "Saved".
 *
 * The chrome and the empty-state content are localized and cached on the
 * server; the list itself is fetched in the client `SavedToursView`, because it
 * lives in a cookie this render knows nothing about.
 */
export default async function WishlistPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    if (!isLocale(locale)) notFound();

    const dict = await getDictionary(locale);
    const destinations = await getActiveDestinations(locale);
    const emptyState = await Promise.all(
        destinations.map(d => emptyStateFor(d, locale, dict.search))
    );

    return (
        <>
            <SavedToursView
                locale={locale as Locale}
                dict={dict.wishlist}
                cardDict={dict.destination.listings}
                durationDict={dict.search}
                destinations={emptyState}
            />
            {/* The same four lines and the same WhatsApp link as All Tours,
                verbatim (mck-17 [H], master 3.11). */}
            <ToursTrustStrip dict={dict.destination.allTours.trust} />
        </>
    );
}
