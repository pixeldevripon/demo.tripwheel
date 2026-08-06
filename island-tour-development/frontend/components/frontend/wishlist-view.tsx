'use client';

import { useEffect, useState } from 'react';

import { WishlistSkeleton } from '@/components/frontend/skeletons/wishlist-skeleton';
import { TourCard, type TourCardDict } from '@/components/frontend/tour-card';
import { useWishlist } from '@/components/frontend/wishlist-provider';
import { wishlistApi, type WishlistTour } from '@/lib/api/wishlist';
import type { Locale } from '@/lib/constants/locales';
import { currencyFromCookie } from '@/lib/currency/current';
import {
    searchHitToListing,
    TOUR_CARD_GRID,
    type DurationDict,
} from '@/lib/tours/listing';
import type { SearchHit } from '@/types/search';

export type WishlistViewDict = {
    title: string;
    empty: string;
    emptyHint: string;
};

/**
 * Wishlist page body - COOKIE-BASED, no login. The provider owns the saved ids
 * (6-month `it.wishlist` cookie); this view resolves them into cards via the
 * public `/wishlist/resolve` endpoint, newest first.
 */
export function WishlistView({
    locale,
    dict,
    cardDict,
    durationDict,
}: {
    locale: Locale;
    dict: WishlistViewDict;
    cardDict: TourCardDict;
    durationDict: DurationDict;
}) {
    const { ready, ids, isSaved } = useWishlist();
    const [tours, setTours] = useState<WishlistTour[]>([]);
    const [loading, setLoading] = useState(true);

    // Resolve the cookie ids into card data once the provider has hydrated.
    // Intentionally NOT re-run on every toggle (ids changes) - un-hearting is
    // reflected optimistically via the `visible` filter below.
    useEffect(() => {
        if (!ready) return;
        if (ids.length === 0) {
            setTours([]);
            setLoading(false);
            return;
        }
        let ignore = false;
        setLoading(true);
        // Convert card prices to the shopper's chosen currency (cookie-resolved).
        const currency = currencyFromCookie(document.cookie, locale);
        wishlistApi
            .resolve(ids, locale, currency)
            .then(rows => {
                if (!ignore) setTours(rows);
            })
            .catch(() => {
                if (!ignore) setTours([]);
            })
            .finally(() => {
                if (!ignore) setLoading(false);
            });
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, locale]);

    // Reflect optimistic removals (un-hearting a card drops it immediately).
    const visible = tours.filter(t => isSaved(t.id));

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container flex flex-col gap-8'>
                <h1 className='m-0 text-[clamp(28px,4vw,40px)] font-bold leading-[1.1] tracking-[-0.018em] text-it-heading'>
                    {dict.title}
                </h1>

                {!ready || loading ? (
                    <WishlistSkeleton />
                ) : visible.length === 0 ? (
                    <Prompt title={dict.empty} hint={dict.emptyHint} />
                ) : (
                    <div className={TOUR_CARD_GRID}>
                        {visible.map(hit => (
                            <TourCard
                                key={hit.id}
                                tour={searchHitToListing(
                                    hit,
                                    locale,
                                    durationDict
                                )}
                                dict={cardDict}
                                wishlistVariant='remove'
                                // Pairs with TOUR_CARD_GRID's single mobile
                                // column - the two are one decision.
                                mobileRow
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function Prompt({ title, hint }: { title: string; hint: string }) {
    return (
        <div className='flex flex-col items-center gap-3 py-16 text-center'>
            <p className='m-0 font-medium text-[18px] md:text-[22px] leading-[1.3] text-it-heading'>
                {title}
            </p>
            <p className='m-0 max-w-md text-[14px] md:text-[16px] leading-[1.6] text-it-heading/60'>
                {hint}
            </p>
        </div>
    );
}

