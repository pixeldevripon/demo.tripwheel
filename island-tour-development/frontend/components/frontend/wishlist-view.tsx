'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { TourCard, type TourCardDict } from '@/components/frontend/tour-card';
import { useWishlist } from '@/components/frontend/wishlist-provider';
import { WishlistSkeleton } from '@/components/frontend/skeletons/wishlist-skeleton';
import { wishlistApi, type WishlistTour } from '@/lib/api/wishlist';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { currencyFromCookie } from '@/lib/currency/current';
import { searchHitToListing, type DurationDict } from '@/lib/tours/listing';

export type WishlistViewDict = {
    title: string;
    empty: string;
    emptyHint: string;
    signInTitle: string;
    signInHint: string;
    signInCta: string;
};

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
    const { ready, isAuthed, isSaved } = useWishlist();
    const [tours, setTours] = useState<WishlistTour[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ready) return;
        if (!isAuthed) {
            setTours([]);
            setLoading(false);
            return;
        }
        let ignore = false;
        setLoading(true);
        // Convert card prices to the shopper's chosen currency (cookie-resolved).
        const currency = currencyFromCookie(document.cookie, locale);
        wishlistApi
            .list(locale, currency)
            .then((rows) => {
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
    }, [ready, isAuthed, locale]);

    // Reflect optimistic removals (un-hearting a card drops it immediately).
    const visible = tours.filter((t) => isSaved(t.id));

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container flex flex-col gap-8'>
                <h1 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                    {dict.title}
                </h1>

                {!ready || loading ? (
                    <WishlistSkeleton />
                ) : !isAuthed ? (
                    <Prompt
                        title={dict.signInTitle}
                        hint={dict.signInHint}
                        cta={dict.signInCta}
                        href={localizeHref(locale, '/login')}
                    />
                ) : visible.length === 0 ? (
                    <Prompt title={dict.empty} hint={dict.emptyHint} />
                ) : (
                    <div className='grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10'>
                        {visible.map((hit) => (
                            <TourCard
                                key={hit.id}
                                tour={searchHitToListing(hit, locale, durationDict)}
                                dict={cardDict}
                                wishlistVariant='remove'
                            />
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
}

function Prompt({
    title,
    hint,
    cta,
    href,
}: {
    title: string;
    hint: string;
    cta?: string;
    href?: string;
}) {
    return (
        <div className='flex flex-col items-center gap-3 py-16 text-center'>
            <p className='m-0 font-medium text-[18px] md:text-[22px] leading-[1.3] text-it-heading'>
                {title}
            </p>
            <p className='m-0 max-w-md text-[14px] md:text-[16px] leading-[1.6] text-it-heading/60'>
                {hint}
            </p>
            {cta && href && (
                <Link
                    href={href}
                    className='mt-2 inline-flex items-center rounded-it-full bg-it-primary px-6 py-3 text-[14px] font-medium text-it-white no-underline transition-colors hover:bg-it-primary-hover'>
                    {cta}
                </Link>
            )}
        </div>
    );
}

