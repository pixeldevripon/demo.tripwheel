'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';

import { useWishlist } from '@/components/frontend/wishlist-provider';
import { localizeHref, type Locale } from '@/lib/constants/locales';

import type { Category, Island, NavDict } from './lib/navbar.types';

/**
 * Mobile drawer below the bar: islands + (inner pages) categories + a wishlist
 * link with a live saved-count. Pure presentation - open state is owned by the
 * navbar (the toggle lives in the action cluster).
 */
export function MobileMenu({
    open,
    onClose,
    locale,
    dict,
    islands,
    categories,
    currentIsland,
    isHome,
}: {
    open: boolean;
    onClose: () => void;
    locale: Locale;
    dict: NavDict;
    islands: Island[];
    categories: Category[];
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
                    transition={{ duration: 0.28, ease: [0.04, 0.62, 0.23, 0.98] }}
                    className='absolute top-18 left-0 right-0 overflow-hidden bg-it-white border-b border-it-border z-50 md:hidden'>
                    <div className='border-t border-it-border px-4 py-6 flex flex-col gap-1'>
                        <span className='px-1 pb-1 text-xs font-medium text-it-ink-muted'>
                            {dict.selectIsland}
                        </span>
                        {islands.map((island, i) => (
                            <motion.div
                                key={island.slug}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.06 + i * 0.05, duration: 0.25 }}>
                                <Link
                                    href={localizeHref(locale, `/${island.slug}`)}
                                    onClick={onClose}
                                    aria-current={island.slug === currentIsland?.slug}
                                    className={`block text-base no-underline py-2 ${island.slug === currentIsland?.slug ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                                    {island.name}
                                </Link>
                            </motion.div>
                        ))}

                        {!isHome && categories.length > 0 && (
                            <>
                                <div className='my-3 h-px bg-it-border' />
                                <span className='px-1 pb-1 text-xs font-medium text-it-ink-muted'>
                                    {dict.categories}
                                </span>
                                {categories.map((cat, i) => (
                                    <motion.div
                                        key={cat.slug}
                                        initial={{ opacity: 0, x: -12 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: 0.1 + i * 0.05, duration: 0.25 }}>
                                        <Link
                                            href={categoryHref(cat.slug)}
                                            onClick={onClose}
                                            className='block text-it-ink text-base no-underline py-2'>
                                            {cat.name}
                                        </Link>
                                    </motion.div>
                                ))}
                            </>
                        )}

                        <div className='my-3 h-px bg-it-border' />

                        <Link
                            href={localizeHref(locale, '/wishlist')}
                            onClick={onClose}
                            aria-label={dict.wishlist}
                            className='flex items-center gap-2.5 no-underline py-2 text-it-ink'>
                            <Image
                                src='/icons/nav-heart.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6'
                            />
                            <span className='text-base'>
                                {dict.wishlist}
                                {count > 0 ? ` (${count})` : ''}
                            </span>
                        </Link>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
