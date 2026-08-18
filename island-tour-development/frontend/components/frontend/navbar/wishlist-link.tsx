'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

import { useWishlist } from '@/components/frontend/wishlist-provider';
import { localizeHref, type Locale } from '@/lib/constants/locales';

import { iconPress, pressSpring } from './lib/navbar.constants';
import type { NavDict } from './lib/navbar.types';

/**
 * Desktop wishlist link - heart icon with a live saved-count badge. The badge
 * springs in/out with the count and re-pops on every change (keyed remount),
 * so saving a tour anywhere on the page gives visible navbar feedback.
 */
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
            href={localizeHref(locale, '/saved')}
            aria-label={dict.saved}
            className='relative flex items-center gap-1.5 no-underline'>
            {/* Mockup navpill: "Saved" label beside the heart. */}
            <span className='text-[13px] font-medium text-it-heading tracking-[-0.012em]'>
                {dict.saved}
            </span>
            <motion.span className='inline-flex' {...iconPress}>
                <Image
                    src='/icons/nav-heart.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-4.5'
                />
            </motion.span>
            <AnimatePresence>
                {count > 0 && (
                    <motion.span
                        key={count}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={pressSpring}
                        className='absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-it-full bg-it-primary px-1 text-[10px] font-medium leading-none text-it-white tabular-nums tracking-[-0.012em]'>
                        {count}
                    </motion.span>
                )}
            </AnimatePresence>
        </Link>
    );
}

