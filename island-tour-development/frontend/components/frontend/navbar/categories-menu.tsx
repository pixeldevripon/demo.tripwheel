'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { localizeHref, type Locale } from '@/lib/constants/locales';

import {
    dropdownItemMotion,
    dropdownMotion,
    pressSpring,
} from './lib/navbar.constants';
import type { Category, Island, NavDict } from './lib/navbar.types';
import { useClickOutside } from './lib/use-click-outside';

/**
 * Desktop categories dropdown. `categories === null` means an island is
 * selected but its categories are still loading - the trigger stays mounted
 * through that window so the header never shifts while data resolves. The
 * whole item (divider + trigger) enters/leaves via a width collapse, and its
 * leading spacing lives inside the collapsing wrapper so it animates to true
 * zero width.
 */
export function CategoriesMenu({
    locale,
    dict,
    categories,
    currentIsland,
    show,
}: {
    locale: Locale;
    dict: NavDict;
    categories: Category[] | null;
    currentIsland: Island | null;
    show: boolean;
}) {
    const [open, setOpen] = useState(false);
    // Clip only while the width collapse is in flight - at rest the wrapper
    // must stay overflow-visible or it would clip the absolute dropdown panel.
    const [collapsing, setCollapsing] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false), open);

    const items = categories ?? [];
    // Loading (null) keeps the item visible; a confirmed empty list hides it.
    const visible = show && (categories === null || items.length > 0);

    const categoryHref = (slug: string) =>
        localizeHref(
            locale,
            currentIsland ? `/${currentIsland.slug}/${slug}` : `/${slug}`
        );

    return (
        <AnimatePresence initial={false}>
            {visible && (
                <motion.div
                    key='categories'
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 'auto', opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: 'easeOut' }}
                    onAnimationStart={() => setCollapsing(true)}
                    onAnimationComplete={() => setCollapsing(false)}
                    className={collapsing ? 'overflow-hidden' : ''}>
                    <div className='flex items-center gap-4 pl-4'>
                        <div className='w-px h-5 bg-it-ink/40' />
                        <div ref={ref} className='relative'>
                            <motion.button
                                onClick={() => setOpen(v => !v)}
                                aria-expanded={open}
                                whileTap={{ scale: 0.98 }}
                                transition={pressSpring}
                                className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-it-ink'>
                                <Image
                                    src='/icons/nav-category.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6 shrink-0'
                                />
                                <span className='text-base font-medium text-it-ink whitespace-nowrap'>
                                    {dict.categories}
                                </span>
                            </motion.button>

                            <AnimatePresence>
                                {open && items.length > 0 && (
                                    <motion.div
                                        {...dropdownMotion}
                                        className='absolute top-[calc(100%+18px)] left-0 min-w-52 origin-top-left bg-it-white border border-it-border-subtle rounded-it-sm shadow-it-lg overflow-hidden z-50'>
                                        {items.map(cat => (
                                            <motion.div
                                                key={cat.slug}
                                                {...dropdownItemMotion}>
                                                <Link
                                                    href={categoryHref(cat.slug)}
                                                    onClick={() =>
                                                        setOpen(false)
                                                    }
                                                    className='block px-5 py-3 text-it-ink text-sm no-underline hover:bg-it-surface transition-colors'>
                                                    {cat.name}
                                                </Link>
                                            </motion.div>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
