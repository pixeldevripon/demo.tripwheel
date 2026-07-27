'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { fetchDestinationCategoriesClient } from '@/lib/api/categories-public';
import { localizeHref, type Locale } from '@/lib/constants/locales';

import { AccountMenu } from './account-menu';
import { CategoriesMenu } from './categories-menu';
import { DestinationSelector } from './destination-selector';
import { LocaleSelector } from './locale-selector';
import { MobileMenu } from './mobile-menu';
import { NavSearch } from './nav-search';
import { iconPress, pressSpring } from './lib/navbar.constants';
import type { Category, Island, NavDict, SearchDict } from './lib/navbar.types';
import { WishlistLink } from './wishlist-link';

/** localStorage key for the last-viewed island (persists the navbar selection). */
const DESTINATION_KEY = 'it.activeDestination';

/**
 * Public-site top bar. Owns only the state shared across its parts: the active
 * island (path + remembered), the destination-scoped categories, and the two
 * mobile toggles. Each selector/search/menu owns its own open state internally.
 */
export function Navbar({
    locale,
    dict,
    search,
    islands,
    logo,
    siteName,
}: {
    locale: Locale;
    dict: NavDict;
    search: SearchDict;
    islands: Island[];
    /** Dashboard-managed logo URL; falls back to the bundled asset. */
    logo?: string | null;
    siteName?: string | null;
}) {
    const pathname = usePathname();

    const [mobileOpen, setMobileOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

    // Any navigation dismisses the mobile drawer/search - the menu links call
    // onClose themselves, but this also covers the logo, search results, and
    // same-layout client transitions where the overlay would otherwise linger.
    useEffect(() => {
        setMobileOpen(false);
        setMobileSearchOpen(false);
    }, [pathname]);

    // Home keeps the discovery layout; every other page shows the inner layout.
    const isHome = pathname === '/' || pathname === `/${locale}`;

    // The island in the URL (first segment after the locale), if any.
    const pathIsland = useMemo(() => {
        const slug = pathname.split('/')[2];
        return islands.find(i => i.slug === slug) ?? null;
    }, [pathname, islands]);

    // Persist the last-viewed island so it stays selected across navigation on
    // inner pages (the home page opts out below). Read once on mount, written
    // whenever the URL resolves to an island.
    const [rememberedSlug, setRememberedSlug] = useState<string | null>(null);
    useEffect(() => {
        setRememberedSlug(window.localStorage.getItem(DESTINATION_KEY));
    }, []);
    useEffect(() => {
        if (pathIsland) {
            window.localStorage.setItem(DESTINATION_KEY, pathIsland.slug);
            setRememberedSlug(pathIsland.slug);
        }
    }, [pathIsland]);

    // The home page always offers a fresh choice: the selector shows
    // "Select your Island" there, never the remembered island. The remembered
    // slug still backs the selector on inner pages without an island in the
    // URL (search, wishlist, ...).
    const currentIsland = isHome
        ? null
        : (pathIsland ?? islands.find(i => i.slug === rememberedSlug) ?? null);

    // Destination-scoped categories - only those with a published tour, so the
    // links never 404. Resolved client-side (the island comes from the path) and
    // cached per `locale:slug`. Shared by the desktop dropdown + mobile drawer.
    // `null` = an island is selected but its categories are still loading; the
    // desktop menu stays mounted through that window so the header never shifts.
    const [categories, setCategories] = useState<Category[] | null>(null);
    const categoryCache = useRef<Map<string, Category[]>>(new Map());
    useEffect(() => {
        const slug = currentIsland?.slug;
        if (!slug) {
            setCategories([]);
            return;
        }
        const cacheKey = `${locale}:${slug}`;
        const cached = categoryCache.current.get(cacheKey);
        if (cached) {
            setCategories(cached);
            return;
        }
        setCategories(null);
        let ignore = false;
        fetchDestinationCategoriesClient(slug, locale)
            .then(rows => {
                if (ignore) return;
                const mapped = rows.map(c => ({ name: c.name, slug: c.slug }));
                categoryCache.current.set(cacheKey, mapped);
                setCategories(mapped);
            })
            .catch(() => {
                if (!ignore) setCategories([]);
            });
        return () => {
            ignore = true;
        };
    }, [currentIsland?.slug, locale]);

    return (
        <header className='fixed top-0 left-0 right-0 z-100 h-18 md:h-20 bg-it-white border-b border-it-border'>
            <div className='it-container h-full flex items-center justify-between gap-6'>
                {/* ── Left: logo + island + categories ── */}
                <div className='flex items-center gap-6 lg:gap-12 shrink-0'>
                    <Link href={localizeHref(locale, '/')} className='shrink-0'>
                        <Image
                            src={logo || '/logo/logo.png'}
                            alt={siteName || 'Island Tours'}
                            width={68}
                            height={50}
                            priority
                            className='h-9 w-auto object-contain md:h-12.5'
                        />
                    </Link>

                    {/* No gap here: CategoriesMenu carries its own leading
                        spacing inside its width-collapse wrapper, so appearing
                        or disappearing animates smoothly to true zero width. */}
                    <div className='hidden md:flex items-center'>
                        <DestinationSelector
                            variant='desktop'
                            locale={locale}
                            dict={dict}
                            islands={islands}
                            currentIsland={currentIsland}
                        />
                        <CategoriesMenu
                            locale={locale}
                            dict={dict}
                            categories={categories}
                            currentIsland={currentIsland}
                            show={!isHome}
                        />
                    </div>
                </div>

                {/* ── Middle: search (desktop pill + mobile overlay) ── */}
                <NavSearch
                    locale={locale}
                    nav={dict}
                    search={search}
                    currentIsland={currentIsland}
                    categories={categories}
                    showDesktop={!isHome}
                    mobileOpen={mobileSearchOpen}
                    onMobileClose={() => setMobileSearchOpen(false)}
                />

                {/* ── Desktop right: language + wishlist + account ── */}
                <div className='hidden md:flex items-center gap-6 shrink-0'>
                    <LocaleSelector variant='desktop' locale={locale} dict={dict} />
                    <div className='w-px h-5 bg-it-border' />
                    <WishlistLink locale={locale} dict={dict} />
                    <div className='w-px h-5 bg-it-border' />
                    <AccountMenu locale={locale} dict={dict} />
                </div>

                {/* ── Mobile right: search + island + language + account + menu ── */}
                <div className='flex md:hidden items-center gap-5'>
                    {!isHome && (
                        <motion.button
                            type='button'
                            onClick={() => {
                                setMobileOpen(false);
                                setMobileSearchOpen(true);
                            }}
                            aria-label={dict.search}
                            aria-expanded={mobileSearchOpen}
                            {...iconPress}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                            <Image
                                src='/icons/nav-search.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6'
                            />
                        </motion.button>
                    )}

                    <DestinationSelector
                        variant='mobile'
                        locale={locale}
                        dict={dict}
                        islands={islands}
                        currentIsland={currentIsland}
                    />
                    <LocaleSelector variant='mobile' locale={locale} dict={dict} />

                    <AccountMenu locale={locale} dict={dict} />

                    <motion.button
                        className='bg-transparent border-none cursor-pointer p-0 text-it-ink'
                        whileTap={{ scale: 0.9 }}
                        transition={pressSpring}
                        aria-label={mobileOpen ? dict.close : dict.menu}
                        onClick={() => setMobileOpen(v => !v)}>
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

            <MobileMenu
                open={mobileOpen}
                onClose={() => setMobileOpen(false)}
                locale={locale}
                dict={dict}
                islands={islands}
                categories={categories ?? []}
                currentIsland={currentIsland}
                isHome={isHome}
            />
        </header>
    );
}
