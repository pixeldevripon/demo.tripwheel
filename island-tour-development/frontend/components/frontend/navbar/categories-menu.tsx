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
 * Desktop categories dropdown. Renders a leading divider + the menu, and only
 * when the current island actually has categories (otherwise null). Category
 * links point into the current island when there is one.
 */
export function CategoriesMenu({
    locale,
    dict,
    categories,
    currentIsland,
}: {
    locale: Locale;
    dict: NavDict;
    categories: Category[];
    currentIsland: Island | null;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false), open);

    if (categories.length === 0) return null;

    const categoryHref = (slug: string) =>
        localizeHref(
            locale,
            currentIsland ? `/${currentIsland.slug}/${slug}` : `/${slug}`
        );

    return (
        <>
            <div className='w-px h-5 bg-it-ink/40' />
            <div ref={ref} className='relative'>
                <motion.button
                    onClick={() => setOpen(v => !v)}
                    aria-expanded={open}
                    whileTap={{ scale: 0.95 }}
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
                    {open && (
                        <motion.div
                            {...dropdownMotion}
                            className='absolute top-[calc(100%+18px)] left-0 min-w-52 origin-top-left bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                            {categories.map(cat => (
                                <motion.div key={cat.slug} {...dropdownItemMotion}>
                                    <Link
                                        href={categoryHref(cat.slug)}
                                        onClick={() => setOpen(false)}
                                        className='block px-5 py-3 text-it-ink text-sm no-underline hover:bg-it-surface transition-colors'>
                                        {cat.name}
                                    </Link>
                                </motion.div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
}
