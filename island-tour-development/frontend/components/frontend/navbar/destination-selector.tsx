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
import type { Island, NavDict } from './lib/navbar.types';
import { useClickOutside } from './lib/use-click-outside';

/**
 * Island selector. `desktop` shows the current island name beside the pin and
 * opens left-aligned; `mobile` is the bare pin in the action cluster and opens
 * right-aligned. Owns its own open state + outside-click.
 */
export function DestinationSelector({
    locale,
    dict,
    islands,
    currentIsland,
    variant,
}: {
    locale: Locale;
    dict: NavDict;
    islands: Island[];
    currentIsland: Island | null;
    variant: 'desktop' | 'mobile';
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false), open);

    // Both variants sit at the header's left edge now (mockup nav order), so
    // the menu always drops left-aligned.
    const menuAlign = 'left-0 origin-top-left';

    return (
        <div ref={ref} className='relative'>
            <motion.button
                onClick={() => setOpen(v => !v)}
                aria-label={dict.selectIsland}
                aria-expanded={open}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                className={
                    variant === 'desktop'
                        ? 'flex items-center gap-2 bg-transparent border border-it-border-subtle rounded-it-full px-3.5 py-2 cursor-pointer text-it-ink transition-colors duration-(--it-duration-xs) ease-(--it-ease) hover:border-it-border'
                        : 'flex items-center gap-1.5 bg-transparent border border-it-border-subtle rounded-it-full px-2.5 py-[7px] cursor-pointer text-it-ink'
                }>
                <Image
                    src='/icons/nav-location.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-4 shrink-0'
                />
                {variant === 'desktop' ? (
                    /* One-cell grid: the invisible spans reserve the width of the
                       longest possible label, so switching islands never shifts
                       the rest of the header. */
                    <span className='inline-grid justify-items-start text-[13.5px] font-semibold text-it-ink whitespace-nowrap'>
                        <span className='col-start-1 row-start-1'>
                            {currentIsland
                                ? currentIsland.name
                                : dict.selectIsland}
                        </span>
                        {islands.map(island => (
                            <span
                                key={island.slug}
                                aria-hidden
                                className='col-start-1 row-start-1 invisible'>
                                {island.name}
                            </span>
                        ))}
                        <span
                            aria-hidden
                            className='col-start-1 row-start-1 invisible'>
                            {dict.selectIsland}
                        </span>
                    </span>
                ) : (
                    /* Mockup mobile .nss: the short island label, never the
                       bare pin. */
                    <span className='text-[12.5px] font-semibold text-it-ink whitespace-nowrap'>
                        {currentIsland ? currentIsland.name : dict.island}
                    </span>
                )}
                <Image
                    src='/icons/nav-chevron-down.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-3.5 shrink-0'
                />
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        {...dropdownMotion}
                        className={`absolute top-[calc(100%+18px)] ${menuAlign} min-w-45 bg-it-white border border-it-border-subtle rounded-it-sm shadow-it-lg overflow-hidden z-50`}>
                        {islands.map(island => (
                            <motion.div
                                key={island.slug}
                                {...dropdownItemMotion}>
                                <Link
                                    href={localizeHref(
                                        locale,
                                        `/${island.slug}`
                                    )}
                                    onClick={() => setOpen(false)}
                                    aria-current={
                                        island.slug === currentIsland?.slug
                                    }
                                    className={`block px-5 py-3 text-sm no-underline hover:bg-it-surface transition-colors ${island.slug === currentIsland?.slug ? 'text-it-primary font-normal' : 'text-it-ink'}`}>
                                    {island.name}
                                </Link>
                            </motion.div>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

