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
                    <div className='flex items-center gap-2 pl-2'>
                        <div ref={ref} className='relative'>
                            <motion.button
                                onClick={() => setOpen(v => !v)}
                                aria-expanded={open}
                                whileTap={{ scale: 0.98 }}
                                transition={pressSpring}
                                className='flex items-center gap-[7px] rounded-it-full bg-transparent border-none cursor-pointer px-3 py-2 text-it-ink'>
                                <Image
                                    src='/icons/nav-categories-grid.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-4 shrink-0'
                                />
                                <span className='text-[13.5px] font-semibold text-it-ink whitespace-nowrap'>
                                    {dict.categories}
                                </span>
                            </motion.button>

                            <AnimatePresence>
                                {open && items.length > 0 && (
                                    <motion.div
                                        {...dropdownMotion}
                                        className='absolute top-[calc(100%+10px)] left-0 w-[340px] origin-top-left bg-it-white rounded-it-sm border border-it-border-subtle shadow-it-lg p-2.5 z-50'>
                                        {items.map(cat => (
                                            <motion.div
                                                key={cat.slug}
                                                {...dropdownItemMotion}>
                                                <Link
                                                    href={categoryHref(
                                                        cat.slug
                                                    )}
                                                    onClick={() =>
                                                        setOpen(false)
                                                    }
                                                    className='flex items-center gap-3 rounded-it-md px-2.5 py-2 no-underline transition-colors duration-(--it-duration-xs) ease-(--it-ease) hover:bg-it-bg'>
                                                    {cat.image ? (
                                                        // eslint-disable-next-line @next/next/no-img-element
                                                        <img
                                                            src={cat.image}
                                                            alt=''
                                                            className='size-11 shrink-0 rounded-it-md object-cover bg-it-bg'
                                                        />
                                                    ) : (
                                                        // No fallback photo -
                                                        // just the paper
                                                        // fallback surface.
                                                        <span className='size-11 shrink-0 rounded-it-md bg-it-bg' />
                                                    )}
                                                    <span className='min-w-0'>
                                                        <b className='block truncate text-sm font-medium text-it-ink'>
                                                            {cat.name}
                                                        </b>
                                                        {cat.tours !==
                                                            undefined && (
                                                            <span className='text-xs text-it-text-muted tabular-nums'>
                                                                {cat.tours}{' '}
                                                                {dict.tours}
                                                            </span>
                                                        )}
                                                    </span>
                                                </Link>
                                            </motion.div>
                                        ))}
                                        {currentIsland && (
                                            <div className='mt-1.5 border-t border-it-divider pt-2'>
                                                <Link
                                                    href={localizeHref(
                                                        locale,
                                                        `/${currentIsland.slug}/tours`
                                                    )}
                                                    onClick={() =>
                                                        setOpen(false)
                                                    }
                                                    className='block rounded-it-md px-2.5 py-2 text-[13.5px] font-medium text-it-primary-hover no-underline transition-colors duration-(--it-duration-xs) ease-(--it-ease) hover:bg-it-bg'>
                                                    {dict.allIslandTours.replace(
                                                        '{destination}',
                                                        currentIsland.name
                                                    )}{' '}
                                                    →
                                                </Link>
                                            </div>
                                        )}
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

