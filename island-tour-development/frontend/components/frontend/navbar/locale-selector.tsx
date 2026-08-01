'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';

import {
    ALL_LOCALES,
    LOCALE_NATIVE_LABELS,
    type Locale,
} from '@/lib/constants/locales';
import { useLocaleSwitch } from '@/lib/i18n/use-locale-switch';

import {
    dropdownItemMotion,
    dropdownMotion,
    pressSpring,
} from './lib/navbar.constants';
import type { NavDict } from './lib/navbar.types';
import { useClickOutside } from './lib/use-click-outside';

/**
 * Language switcher. `desktop` shows the active locale code beside the globe;
 * `mobile` is the bare globe. Switching swaps the first path segment, remembers
 * the choice in a cookie, and navigates. Owns its own open state + outside-click.
 */
export function LocaleSelector({
    locale,
    dict,
    variant,
}: {
    locale: Locale;
    dict: NavDict;
    variant: 'desktop' | 'mobile';
}) {
    const [open, setOpen] = useState(false);
    const { isPending, prefetchLocales, switchLocale } =
        useLocaleSwitch(locale);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false), open);

    function toggleOpen() {
        setOpen(v => {
            // Warm the other locale variants while the reader scans the menu,
            // so the eventual switch commits instantly.
            if (!v) prefetchLocales();
            return !v;
        });
    }

    function pickLocale(next: Locale) {
        setOpen(false);
        switchLocale(next);
    }

    const menuWidth = variant === 'desktop' ? 'min-w-45' : 'min-w-48';

    return (
        <div ref={ref} className='relative'>
            <motion.button
                onClick={toggleOpen}
                aria-label={dict.language}
                aria-expanded={open}
                aria-busy={isPending}
                whileTap={{ scale: 0.98 }}
                transition={pressSpring}
                className={`flex items-center gap-2 bg-transparent border-none cursor-pointer p-0 text-it-ink transition-opacity duration-300 ${isPending ? 'opacity-50' : 'opacity-100'}`}>
                <Image
                    src='/icons/nav-globe.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-4.5 shrink-0'
                />
                {variant === 'desktop' && (
                    /* One-cell grid: invisible spans reserve the width of the
                       widest locale code, so switching locales never shifts
                       the rest of the header. */
                    <span className='inline-grid justify-items-start text-[13px] font-semibold text-it-ink uppercase'>
                        <span className='col-start-1 row-start-1'>
                            {locale}
                        </span>
                        {ALL_LOCALES.map(code => (
                            <span
                                key={code}
                                aria-hidden
                                className='col-start-1 row-start-1 invisible'>
                                {code}
                            </span>
                        ))}
                    </span>
                )}
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.ul
                        {...dropdownMotion}
                        className={`absolute top-[calc(100%+18px)] right-0 m-0 p-0 list-none ${menuWidth} origin-top-right bg-it-white border border-it-border-subtle rounded-it-sm shadow-it-lg overflow-hidden z-50`}>
                        {ALL_LOCALES.map(code => (
                            <motion.li key={code} {...dropdownItemMotion}>
                                <button
                                    onClick={() => pickLocale(code)}
                                    aria-current={code === locale}
                                    className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm bg-transparent border-none cursor-pointer transition-colors hover:bg-it-surface ${code === locale ? 'text-it-primary font-normal' : 'text-it-ink'}`}>
                                    <span>{LOCALE_NATIVE_LABELS[code]}</span>
                                    <span className='uppercase text-xs text-it-ink-muted'>
                                        {code}
                                    </span>
                                </button>
                            </motion.li>
                        ))}
                    </motion.ul>
                )}
            </AnimatePresence>
        </div>
    );
}

