'use client';

import Image from 'next/image';
import Link from 'next/link';

import { useWishlist } from '@/components/frontend/wishlist-provider';
import { localizeHref, type Locale } from '@/lib/constants/locales';

import type { NavDict } from './lib/navbar.types';

/** Desktop wishlist link - heart icon with a live saved-count badge. */
export function WishlistLink({
    locale,
    dict,
}: {
    locale: Locale;
    dict: NavDict;
}) {
    const { count } = useWishlist();

    return (
        <Link
            href={localizeHref(locale, '/wishlist')}
            aria-label={dict.wishlist}
            className='relative flex items-center no-underline'>
            <Image
                src='/icons/nav-heart.svg'
                alt=''
                width={24}
                height={24}
                className='size-6'
            />
            {count > 0 && (
                <span className='absolute -top-2 -right-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-it-full bg-it-primary px-1 text-[10px] font-medium leading-none text-it-white'>
                    {count}
                </span>
            )}
        </Link>
    );
}
