'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    ALL_LOCALES,
    LOCALE_COOKIE,
    LOCALE_NATIVE_LABELS,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';

// Pre-defined islands - explicit slugs (not generated at click time).
const islands: { name: string; slug: string }[] = [
    { name: 'Curaçao', slug: 'curacao' },
    { name: 'Aruba', slug: 'aruba' },
    { name: 'Sint Maarten', slug: 'sint-maarten' },
    { name: 'Saint Lucia', slug: 'saint-lucia' },
    { name: 'Bonaire', slug: 'bonaire' },
];

// Global categories - explicit slugs (names are proper nouns, not translated here).
const categories: { name: string; slug: string }[] = [
    { name: 'Boat Tours', slug: 'boat-tours' },
    { name: 'Snorkeling', slug: 'snorkeling' },
    { name: 'Boat Tours', slug: 'boat-tours' },
    { name: 'Off-Road Tours', slug: 'off-road-tours' },
    { name: 'Island Hopping', slug: 'island-hopping' },
];

type NavDict = {
    selectIsland: string;
    wishlist: string;
    account: string;
    menu: string;
    close: string;
    language: string;
    categories: string;
    search: string;
};

const springFast = { type: 'spring', stiffness: 400, damping: 17 } as const;

const dropdownMotion = {
    initial: { opacity: 0, y: -8, scale: 0.97 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: -8, scale: 0.97 },
    transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
} as const;

/** Globe icon - single language affordance shared by every locale. */
function Globe({ className = 'size-6' }: { className?: string }) {
    return (
        <Image
            src='/icons/nav-globe.svg'
            alt=''
            width={24}
            height={24}
            className={`shrink-0 ${className}`}
        />
    );
}

export function Navbar({ locale, dict }: { locale: Locale; dict: NavDict }) {
    const pathname = usePathname();
    const router = useRouter();

    const [islandOpen, setIslandOpen] = useState(false);
    const [catOpen, setCatOpen] = useState(false);
    const [langOpen, setLangOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const islandRef = useRef<HTMLDivElement>(null);
    const catRef = useRef<HTMLDivElement>(null);
    const langRef = useRef<HTMLDivElement>(null);
    const mobileLangRef = useRef<HTMLDivElement>(null);
    const mobileIslandRef = useRef<HTMLDivElement>(null);
    const mobileSearchInputRef = useRef<HTMLInputElement>(null);

    // Home keeps the discovery layout ("Select your Island"); every other page
    // shows the inner layout (current island + Categories + search pill).
    const isHome = pathname === '/' || pathname === `/${locale}`;

    // Resolve the active island from the first segment after the locale.
    const currentIsland = useMemo(() => {
        const slug = pathname.split('/')[2];
        return islands.find((i) => i.slug === slug) ?? null;
    }, [pathname]);

    // Category links point into the current island when there is one.
    const categoryHref = (slug: string) =>
        localizeHref(locale, currentIsland ? `/${currentIsland.slug}/${slug}` : `/${slug}`);

    // Submit search → /[locale]/search?q=…
    function submitSearch(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        setMobileSearchOpen(false);
        router.push(`${localizeHref(locale, '/search')}?q=${encodeURIComponent(q)}`);
    }

    // Close any open dropdown when clicking outside of it.
    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            const target = event.target as Node;
            const insideIsland =
                islandRef.current?.contains(target) ||
                mobileIslandRef.current?.contains(target);
            if (!insideIsland) setIslandOpen(false);
            if (catRef.current && !catRef.current.contains(target)) setCatOpen(false);
            const insideLang =
                langRef.current?.contains(target) || mobileLangRef.current?.contains(target);
            if (!insideLang) setLangOpen(false);
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);

    // Focus the mobile search field as soon as it expands.
    useEffect(() => {
        if (mobileSearchOpen) mobileSearchInputRef.current?.focus();
    }, [mobileSearchOpen]);

    // Switch locale: swap the first path segment, remember the choice, navigate.
    function switchLocale(next: Locale) {
        setLangOpen(false);
        setMobileOpen(false);
        if (next === locale) return;

        const segments = pathname.split('/');
        segments[1] = next; // [0] is '' (leading slash), [1] is the locale
        const nextPath = segments.join('/') || `/${next}`;

        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
        router.push(nextPath);
    }

    const localeOptions = (
        <>
            {ALL_LOCALES.map((code) => (
                <li key={code}>
                    <button
                        onClick={() => switchLocale(code)}
                        aria-current={code === locale}
                        className={`flex w-full items-center justify-between gap-3 px-5 py-3 text-left text-sm bg-transparent border-none cursor-pointer transition-colors hover:bg-it-surface ${code === locale ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                        <span>{LOCALE_NATIVE_LABELS[code]}</span>
                        <span className='uppercase text-xs text-it-ink-muted'>{code}</span>
                    </button>
                </li>
            ))}
        </>
    );

    return (
        <header className='fixed top-0 left-0 right-0 z-100 h-18 md:h-20 bg-it-white border-b border-it-border'>
            <div className='it-container h-full flex items-center justify-between gap-6'>
                {/* ── Left: Logo + (island / categories) ── */}
                <div className='flex items-center gap-6 lg:gap-12 shrink-0'>
                    <Link href={localizeHref(locale, '/')} className='shrink-0'>
                        <Image
                            src='/logo/logo.png'
                            alt='Island Tours'
                            width={68}
                            height={50}
                            priority
                            className='h-9 w-auto object-contain md:h-12.5'
                        />
                    </Link>

                    {/* Island + Categories selectors - desktop only */}
                    <div className='hidden md:flex items-center gap-4'>
                        {/* Island selector */}
                        <div ref={islandRef} className='relative'>
                            <button
                                onClick={() => {
                                    setLangOpen(false);
                                    setCatOpen(false);
                                    setIslandOpen(v => !v);
                                }}
                                aria-expanded={islandOpen}
                                className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0'>
                                <Image
                                    src='/icons/nav-location.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6 shrink-0'
                                />
                                <span className='text-base font-medium text-it-ink whitespace-nowrap'>
                                    {currentIsland
                                        ? currentIsland.name
                                        : dict.selectIsland}
                                </span>
                            </button>

                            <AnimatePresence>
                                {islandOpen && (
                                    <motion.div
                                        {...dropdownMotion}
                                        className='absolute top-[calc(100%+18px)] left-0 min-w-45 origin-top-left bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                        {islands.map(island => (
                                            <Link
                                                key={island.slug}
                                                href={localizeHref(
                                                    locale,
                                                    `/${island.slug}`
                                                )}
                                                onClick={() =>
                                                    setIslandOpen(false)
                                                }
                                                aria-current={
                                                    island.slug ===
                                                    currentIsland?.slug
                                                }
                                                className={`block px-5 py-3 text-sm no-underline hover:bg-it-surface transition-colors ${island.slug === currentIsland?.slug ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                                                {island.name}
                                            </Link>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Inner pages: divider + Categories dropdown */}
                        {!isHome && (
                            <>
                                <div className='w-px h-5 bg-it-ink/40' />
                                <div ref={catRef} className='relative'>
                                    <button
                                        onClick={() => {
                                            setLangOpen(false);
                                            setIslandOpen(false);
                                            setCatOpen(v => !v);
                                        }}
                                        aria-expanded={catOpen}
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
                                    </button>

                                    <AnimatePresence>
                                        {catOpen && (
                                            <motion.div
                                                {...dropdownMotion}
                                                className='absolute top-[calc(100%+18px)] left-0 min-w-52 origin-top-left bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                                {categories.map(cat => (
                                                    <Link
                                                        key={cat.slug}
                                                        href={categoryHref(
                                                            cat.slug
                                                        )}
                                                        onClick={() =>
                                                            setCatOpen(false)
                                                        }
                                                        className='block px-5 py-3 text-it-ink text-sm no-underline hover:bg-it-surface transition-colors'>
                                                        {cat.name}
                                                    </Link>
                                                ))}
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Inner pages: search input (desktop, fills the middle - 1px #2c2c2c pill) ── */}
                {!isHome && (
                    <form
                        onSubmit={submitSearch}
                        role='search'
                        className='hidden md:flex flex-1 items-center gap-2 max-w-141.25 rounded-it-full border border-[rgba(44,44,44,0.20)] px-4 py-3 bg-it-white'>
                        <button
                            type='submit'
                            aria-label={dict.search}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                            <Image
                                src='/icons/nav-search.svg'
                                alt=''
                                width={18}
                                height={18}
                                className='size-4.5 shrink-0'
                            />
                        </button>
                        <input
                            type='search'
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder={dict.search}
                            aria-label={dict.search}
                            className='flex-1 min-w-0 bg-transparent border-none outline-none text-base text-it-heading placeholder:text-it-text-muted [&::-webkit-search-cancel-button]:appearance-none'
                        />
                    </form>
                )}

                {/* ── Desktop right: Language + Wishlist + Account ── */}
                <div className='hidden md:flex items-center gap-6 shrink-0'>
                    {/* Language switcher */}
                    <div ref={langRef} className='relative'>
                        <button
                            onClick={() => {
                                setIslandOpen(false);
                                setCatOpen(false);
                                setLangOpen(v => !v);
                            }}
                            aria-label={dict.language}
                            aria-expanded={langOpen}
                            className='flex items-center gap-2 bg-transparent border-none cursor-pointer p-0'>
                            <Globe />
                            <span className='text-base font-medium text-it-ink uppercase'>
                                {locale}
                            </span>
                        </button>

                        <AnimatePresence>
                            {langOpen && (
                                <motion.ul
                                    {...dropdownMotion}
                                    className='absolute top-[calc(100%+18px)] right-0 m-0 p-0 list-none min-w-45 origin-top-right bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                    {localeOptions}
                                </motion.ul>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className='w-px h-5 bg-it-border' />

                    <button
                        aria-label={dict.wishlist}
                        className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                        <Image
                            src='/icons/nav-heart.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6'
                        />
                    </button>

                    <div className='w-px h-5 bg-it-border' />

                    <Link
                        href='/login'
                        aria-label={dict.account}
                        className='flex items-center no-underline'>
                        <Image
                            src='/icons/nav-profile.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6'
                        />
                    </Link>
                </div>

                {/* ── Mobile right: Search (inner) + Language + Account + Menu ── */}
                <div className='flex md:hidden items-center gap-5'>
                    {!isHome && (
                        <button
                            type='button'
                            onClick={() => {
                                setMobileOpen(false);
                                setLangOpen(false);
                                setMobileSearchOpen(true);
                            }}
                            aria-label={dict.search}
                            aria-expanded={mobileSearchOpen}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                            <Image
                                src='/icons/nav-search.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6'
                            />
                        </button>
                    )}

                    {/* Destination / island selector - location pin beside the globe */}
                    <div ref={mobileIslandRef} className='relative'>
                        <button
                            onClick={() => {
                                setLangOpen(false);
                                setIslandOpen(v => !v);
                            }}
                            aria-label={dict.selectIsland}
                            aria-expanded={islandOpen}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0 text-it-ink'>
                            <Image
                                src='/icons/nav-location.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                        </button>

                        <AnimatePresence>
                            {islandOpen && (
                                <motion.div
                                    {...dropdownMotion}
                                    className='absolute top-[calc(100%+18px)] right-0 min-w-45 origin-top-right bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                    {islands.map(island => (
                                        <Link
                                            key={island.slug}
                                            href={localizeHref(locale, `/${island.slug}`)}
                                            onClick={() => setIslandOpen(false)}
                                            aria-current={island.slug === currentIsland?.slug}
                                            className={`block px-5 py-3 text-sm no-underline hover:bg-it-surface transition-colors ${island.slug === currentIsland?.slug ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                                            {island.name}
                                        </Link>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Language */}
                    <div ref={mobileLangRef} className='relative'>
                        <button
                            onClick={() => setLangOpen(v => !v)}
                            aria-label={dict.language}
                            aria-expanded={langOpen}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0 text-it-ink'>
                            <Globe />
                        </button>

                        <AnimatePresence>
                            {langOpen && (
                                <motion.ul
                                    {...dropdownMotion}
                                    className='absolute top-[calc(100%+18px)] right-0 m-0 p-0 list-none min-w-48 origin-top-right bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                                    {localeOptions}
                                </motion.ul>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* Account */}
                    <Link
                        href='/login'
                        aria-label={dict.account}
                        className='flex items-center no-underline'>
                        <Image
                            src='/icons/nav-profile.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6'
                        />
                    </Link>

                    {/* Menu toggle */}
                    <motion.button
                        className='bg-transparent border-none cursor-pointer p-0 text-it-ink'
                        whileTap={{ scale: 0.85 }}
                        transition={springFast}
                        aria-label={mobileOpen ? dict.close : dict.menu}
                        onClick={() => {
                            setLangOpen(false);
                            setMobileOpen(v => !v);
                        }}>
                        <AnimatePresence mode='wait' initial={false}>
                            <motion.span
                                key={mobileOpen ? 'close' : 'open'}
                                className='inline-flex'
                                initial={{ rotate: -90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: 90, opacity: 0 }}
                                transition={{ duration: 0.18 }}>
                                {mobileOpen ? (
                                    <X size={24} strokeWidth={1.5} />
                                ) : (
                                    <Menu size={24} strokeWidth={1.5} />
                                )}
                            </motion.span>
                        </AnimatePresence>
                    </motion.button>
                </div>
            </div>

            {/* ── Mobile search - expands over the bar when the search icon is tapped ── */}
            <AnimatePresence>
                {mobileSearchOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className='absolute inset-0 z-50 flex items-center gap-3 bg-it-white px-4 md:hidden'>
                        <button
                            type='button'
                            onClick={() => setMobileSearchOpen(false)}
                            aria-label={dict.close}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0 text-it-heading'>
                            <ArrowLeft size={24} strokeWidth={1.5} />
                        </button>
                        <form
                            onSubmit={submitSearch}
                            role='search'
                            className='flex flex-1 items-center gap-2 rounded-it-full border border-it-heading px-4 py-2.5 bg-it-white'>
                            <input
                                ref={mobileSearchInputRef}
                                type='search'
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder={dict.search}
                                aria-label={dict.search}
                                className='flex-1 min-w-0 bg-transparent border-none outline-none text-base text-it-heading placeholder:text-it-text-muted [&::-webkit-search-cancel-button]:appearance-none'
                            />
                            <button
                                type='submit'
                                aria-label={dict.search}
                                className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                                <Image
                                    src='/icons/nav-search.svg'
                                    alt=''
                                    width={18}
                                    height={18}
                                    className='size-4.5 shrink-0'
                                />
                            </button>
                        </form>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Mobile menu (islands + categories + wishlist) ── */}
            <AnimatePresence>
                {mobileOpen && (
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
                            <span className='px-1 pb-1 text-xs font-medium  text-it-ink-muted'>
                                {dict.selectIsland}
                            </span>
                            {islands.map((island, i) => (
                                <motion.div
                                    key={island.slug}
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{
                                        delay: 0.06 + i * 0.05,
                                        duration: 0.25,
                                    }}>
                                    <Link
                                        href={localizeHref(
                                            locale,
                                            `/${island.slug}`
                                        )}
                                        onClick={() => setMobileOpen(false)}
                                        aria-current={
                                            island.slug === currentIsland?.slug
                                        }
                                        className={`block text-base no-underline py-2 ${island.slug === currentIsland?.slug ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                                        {island.name}
                                    </Link>
                                </motion.div>
                            ))}

                            {!isHome && (
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
                                            transition={{
                                                delay: 0.1 + i * 0.05,
                                                duration: 0.25,
                                            }}>
                                            <Link
                                                href={categoryHref(cat.slug)}
                                                onClick={() =>
                                                    setMobileOpen(false)
                                                }
                                                className='block text-it-ink text-base no-underline py-2'>
                                                {cat.name}
                                            </Link>
                                        </motion.div>
                                    ))}
                                </>
                            )}

                            <div className='my-3 h-px bg-it-border' />

                            <button
                                aria-label={dict.wishlist}
                                className='flex items-center gap-2.5 bg-transparent border-none cursor-pointer p-0 py-2 text-it-ink'>
                                <Image
                                    src='/icons/nav-heart.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6'
                                />
                                <span className='text-base'>
                                    {dict.wishlist}
                                </span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
}


