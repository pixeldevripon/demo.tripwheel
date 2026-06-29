'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRef, useState } from 'react';

import { localizeHref, type Locale } from '@/lib/constants/locales';

import { dropdownMotion } from './lib/navbar.constants';
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

    const menuAlign =
        variant === 'desktop'
            ? 'left-0 origin-top-left'
            : 'right-0 origin-top-right';

    return (
        <div ref={ref} className='relative'>
            <button
                onClick={() => setOpen(v => !v)}
                aria-label={dict.selectIsland}
                aria-expanded={open}
                className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-it-ink'>
                <Image
                    src='/icons/nav-location.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6 shrink-0'
                />
                {variant === 'desktop' && (
                    <span className='text-base font-medium text-it-ink whitespace-nowrap'>
                        {currentIsland ? currentIsland.name : dict.selectIsland}
                    </span>
                )}
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        {...dropdownMotion}
                        className={`absolute top-[calc(100%+18px)] ${menuAlign} min-w-45 bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50`}>
                        {islands.map(island => (
                            <Link
                                key={island.slug}
                                href={localizeHref(locale, `/${island.slug}`)}
                                onClick={() => setOpen(false)}
                                aria-current={island.slug === currentIsland?.slug}
                                className={`block px-5 py-3 text-sm no-underline hover:bg-it-surface transition-colors ${island.slug === currentIsland?.slug ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                                {island.name}
                            </Link>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
