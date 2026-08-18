'use client';

import {
    ALL_CURRENCIES,
    ALL_LOCALES,
    CURRENCY_LABELS,
    CURRENCY_NAMES,
    LOCALE_CURRENCY,
    LOCALE_NATIVE_LABELS,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { persistCurrency, storedCurrency } from '@/lib/currency/current';
import { useLocaleSwitch } from '@/lib/i18n/use-locale-switch';
import {
    dropdownUpItemMotion,
    dropdownUpMotion,
    springPop,
} from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';

/**
 * Footer selector pills (language + currency) - the footer's ONLY interactive
 * portion, isolated as the client leaf (STRONG RULE: the footer itself stays a
 * server component). Both open upward with the canonical menu motion.
 */

/** White pill selector shared shell - icon + label on the left, rotating caret on the right. */
function SelectorPill({
    icon,
    label,
    open,
    onToggle,
    ariaLabel,
    children,
    pillRef,
    busy = false,
}: {
    icon: React.ReactNode;
    label: string;
    open: boolean;
    onToggle: () => void;
    ariaLabel: string;
    children: React.ReactNode;
    pillRef: React.RefObject<HTMLDivElement | null>;
    busy?: boolean;
}) {
    return (
        <div ref={pillRef} className='relative w-full'>
            <motion.button
                type='button'
                aria-label={ariaLabel}
                aria-expanded={open}
                aria-busy={busy}
                onClick={onToggle}
                transition={springPop}
                className={`flex h-11 w-full cursor-pointer items-center justify-between gap-2 rounded-it-full border-none bg-it-white px-4 transition-opacity duration-300 ${busy ? 'opacity-50' : 'opacity-100'}`}>
                <span className='flex items-center gap-2.5'>
                    {icon}
                    <span className='text-sm lg:text-base leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        {label}
                    </span>
                </span>
                <motion.span
                    className='inline-flex'
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.2 }}>
                    <Image
                        src='/footer/arrow-down.svg'
                        alt=''
                        width={24}
                        height={24}
                        className='size-4'
                    />
                </motion.span>
            </motion.button>
            <AnimatePresence>{open && children}</AnimatePresence>
        </div>
    );
}

/**
 * Dropdown list rendered above the pill - the canonical upward menu motion
 * from `@/lib/motion` (same spring + item cascade as the navbar dropdowns).
 */
function SelectorMenu({ children }: { children: React.ReactNode }) {
    return (
        <motion.ul
            {...dropdownUpMotion}
            className='absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 m-0 list-none origin-bottom overflow-hidden rounded-it-lg border border-it-border-subtle bg-it-white p-0 shadow-it-lg'>
            {children}
        </motion.ul>
    );
}

/**
 * Interactive currency selector - opens upward, and the ONLY thing in the app
 * that writes the currency cookie.
 *
 * Master 1.3 (locked June 10, 2026): "The locale sets the default; a currency
 * selector in the global footer lets the user override it" - EN/ZH default to
 * USD, the five European locales to EUR - and "IP-based currency localization
 * is roadmap". So there are exactly two inputs, in this order:
 *
 *   1. the cookie, which now means ONE thing: this user picked that currency;
 *   2. otherwise the locale default.
 *
 * Nothing infers currency from the device or the IP. That inference used to run
 * (edge country header in the proxy, browser time zone on mount) and was the
 * bug behind /en showing EUR: it wrote the cookie before the visitor chose
 * anything, so the locale default never got a turn.
 *
 * The initial state is the locale default, matching what the server rendered,
 * so the pill and the prices agree on first paint; a stored pick overrides it
 * on mount. Switching locale therefore moves the currency with it - until the
 * visitor picks one here, which then outranks the locale everywhere.
 *
 * Selecting a currency writes the cookie and calls `router.refresh()` so every
 * server component refetches currency-aware prices (guide §21.2).
 */
export function CurrencySelector({
    locale,
    label,
}: {
    locale: Locale;
    label: string;
}) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const [currency, setCurrency] = useState<Currency>(
        LOCALE_CURRENCY[locale] ?? 'EUR'
    );
    const ref = useRef<HTMLDivElement>(null);

    // Adopt the visitor's own earlier choice once mounted. The initial state
    // mirrors the server's locale default, so this only moves the pill when
    // that person actually picked a currency before.
    useEffect(() => {
        const stored = storedCurrency(document.cookie);
        if (stored) setCurrency(stored);
    }, []);

    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node))
                setOpen(false);
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);

    function selectCurrency(next: Currency) {
        setOpen(false);
        if (next === currency) return;
        setCurrency(next);
        persistCurrency(next);
        // Re-run server components so every price refetches in the new currency
        // (the cookie is the source of truth read by getServerCurrency).
        startTransition(() => {
            router.refresh();
        });
    }

    return (
        <SelectorPill
            pillRef={ref}
            ariaLabel={label}
            busy={isPending}
            label={CURRENCY_LABELS[currency]}
            open={open}
            onToggle={() => setOpen(v => !v)}
            icon={
                <Image
                    src='/footer/currency.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6'
                />
            }>
            <SelectorMenu>
                {ALL_CURRENCIES.map(code => (
                    <motion.li key={code} {...dropdownUpItemMotion}>
                        <button
                            type='button'
                            onClick={() => selectCurrency(code)}
                            aria-current={code === currency}
                            className={`flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-2.5 text-left text-sm transition-colors hover:bg-it-surface ${code === currency ? 'font-medium text-it-primary tracking-[-0.012em]' : ''}`}>
                            <span>{CURRENCY_NAMES[code]}</span>
                            <span className='text-xs uppercase text-it-text-muted tracking-[-0.012em]'>
                                {code}
                            </span>
                        </button>
                    </motion.li>
                ))}
            </SelectorMenu>
        </SelectorPill>
    );
}

/** Interactive language selector - opens upward, switches locale (same behaviour as the navbar). */
export function LanguageSelector({
    locale,
    label,
}: {
    locale: Locale;
    label: string;
}) {
    const [open, setOpen] = useState(false);
    const { isPending, prefetchLocales, switchLocale } =
        useLocaleSwitch(locale);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node))
                setOpen(false);
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);

    function pickLocale(next: Locale) {
        setOpen(false);
        switchLocale(next);
    }

    return (
        <SelectorPill
            pillRef={ref}
            ariaLabel={label}
            busy={isPending}
            label={`${LOCALE_NATIVE_LABELS[locale]} (${locale.toUpperCase()})`}
            open={open}
            onToggle={() =>
                setOpen(v => {
                    // Warm the other locale variants while the menu is open, so
                    // the eventual switch commits instantly.
                    if (!v) prefetchLocales();
                    return !v;
                })
            }
            icon={
                <Image
                    src='/footer/globe.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6'
                />
            }>
            <SelectorMenu>
                {ALL_LOCALES.map(code => (
                    <motion.li key={code} {...dropdownUpItemMotion}>
                        <button
                            type='button'
                            onClick={() => pickLocale(code)}
                            aria-current={code === locale}
                            className={`flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-2.5 text-left text-sm transition-colors hover:bg-it-surface ${code === locale ? 'font-medium text-it-primary tracking-[-0.012em]' : ''}`}>
                            <span>{LOCALE_NATIVE_LABELS[code]}</span>
                            <span className='text-xs uppercase text-it-text-muted tracking-[-0.012em]'>
                                {code}
                            </span>
                        </button>
                    </motion.li>
                ))}
            </SelectorMenu>
        </SelectorPill>
    );
}

