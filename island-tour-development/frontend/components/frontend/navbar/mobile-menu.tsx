'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { useWishlist } from '@/components/frontend/wishlist-provider';
import { localizeHref, type Locale } from '@/lib/constants/locales';

import type { Category, Island, NavDict, NavHub } from './lib/navbar.types';

/**
 * Mobile drawer below the bar: (inner pages) hubs + categories + a wishlist
 * link with a live saved-count. Pure presentation - open state is owned by
 * the navbar (the toggle lives in the action cluster).
 *
 * The island's qualifying hubs sit ABOVE the categories (MCK-19), same order
 * as the desktop dropdown, distinguished by the pin rather than a heading -
 * a place reads as a place everywhere.
 *
 * Islands deliberately do NOT appear here: the bar's own island pill opens the
 * same list a couple of inches away (client, 2026-08-05).
 */
export function MobileMenu({
    open,
    onClose,
    locale,
    dict,
    categories,
    hubs = [],
    currentIsland,
    isHome,
}: {
    open: boolean;
    onClose: () => void;
    locale: Locale;
    dict: NavDict;
    categories: Category[];
    hubs?: NavHub[];
    currentIsland: Island | null;
    isHome: boolean;
}) {
    const { count } = useWishlist();

    const categoryHref = (slug: string) =>
        localizeHref(
            locale,
            currentIsland ? `/${currentIsland.slug}/${slug}` : `/${slug}`
        );

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{
                        duration: 0.28,
                        ease: [0.04, 0.62, 0.23, 0.98],
                    }}
                    className='absolute top-18 left-0 right-0 overflow-hidden bg-it-white border-b border-it-border z-50 md:hidden'>
                    <div className='border-t border-it-border px-4 py-6 flex flex-col gap-1'>
                        {/* No island list here: the bar's own island pill sits
                            two inches away and opens the same choice, so
                            repeating it inside the drawer was redundant
                            (client, 2026-08-05). */}
                        {!isHome && categories.length > 0 && (
                            <>
                                <span className='px-1 pb-1 text-xs font-normal text-it-ink-muted'>
                                    {dict.categories}
                                </span>
                                {hubs.map((hub, i) => (
                                    <motion.div
                                        key={hub.slug}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            delay: 0.1 + i * 0.05,
                                            duration: 0.25,
                                        }}>
                                        <Link
                                            href={categoryHref(hub.slug)}
                                            onClick={onClose}
                                            className='flex items-center gap-1.5 text-it-ink text-base no-underline py-2'>
                                            <MapPin
                                                className='size-3.5 shrink-0 text-it-primary'
                                                strokeWidth={2}
                                                aria-hidden='true'
                                            />
                                            {hub.name}
                                        </Link>
                                    </motion.div>
                                ))}
                                {categories.map((cat, i) => (
                                    <motion.div
                                        key={cat.slug}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{
                                            delay:
                                                0.1 +
                                                (hubs.length + i) * 0.05,
                                            duration: 0.25,
                                        }}>
                                        <Link
                                            href={categoryHref(cat.slug)}
                                            onClick={onClose}
                                            className='block text-it-ink text-base no-underline py-2'>
                                            {cat.name}
                                        </Link>
                                    </motion.div>
                                ))}
                                {/* Divider only when something precedes it -
                                    on the homepage the drawer is the Saved row
                                    alone, and a rule above it would point at
                                    nothing. */}
                                <div className='my-3 h-px bg-it-border' />
                            </>
                        )}

                        <Link
                            href={localizeHref(locale, '/saved')}
                            onClick={onClose}
                            aria-label={dict.saved}
                            className='flex items-center gap-2.5 no-underline py-2 text-it-ink'>
                            <Image
                                src='/icons/nav-heart.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6'
                            />
                            <span className='text-base'>
                                {dict.saved}
                                {count > 0 ? ` (${count})` : ''}
                            </span>
                        </Link>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

