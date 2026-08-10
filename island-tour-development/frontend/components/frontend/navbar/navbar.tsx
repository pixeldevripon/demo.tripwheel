'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useWishlist } from '@/components/frontend/wishlist-provider';
import { fetchDestinationCategoriesClient } from '@/lib/api/categories-public';
import { fetchDestinationHubsClient } from '@/lib/api/hubs-public';
import { fetchDestinationPopularLinksClient } from '@/lib/api/popular-links-public';
import { localizeHref, type Locale } from '@/lib/constants/locales';

import { AccountMenu } from './account-menu';
import { CategoriesMenu } from './categories-menu';
import { DestinationSelector } from './destination-selector';
import { LocaleSelector } from './locale-selector';
import { MobileMenu } from './mobile-menu';
import { NavSearch } from './nav-search';
import { iconPress, pressSpring } from './lib/navbar.constants';
import type {
    Category,
    Island,
    NavDict,
    NavHub,
    SearchDict,
} from './lib/navbar.types';
import type { DestinationPopularLink } from '@/types/destination';
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
    // Drives the hamburger's saved-count badge (the mobile bar has no Saved
    // slot of its own - it lives in the drawer).
    const { count: wishlistCount } = useWishlist();

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
    // "Select your island" there, never the remembered island. The remembered
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
                const mapped = rows.map(c => ({
                    name: c.name,
                    slug: c.slug,
                    tours: c.publishedTourCount,
                    // Only the category's OWN photo - never the generic
                    // ogImage default. Missing = the grey fallback surface.
                    image: c.heroImage ?? null,
                }));
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

    /*
     * The island's activity hubs - the categories dropdown's PLACE row (MCK-19:
     * the dropdown was the one surface in the chrome with no route to a hub).
     * Same client-side resolution, cache and fail-to-empty as the categories
     * above. Gated at >= 3 bookable tours - the same shape of gate master 2.4
     * applies to categories - so Klein Curacao qualifies and a two-tour hub
     * does not.
     */
    const [hubs, setHubs] = useState<NavHub[]>([]);
    const hubCache = useRef<Map<string, NavHub[]>>(new Map());
    useEffect(() => {
        const slug = currentIsland?.slug;
        if (!slug) {
            setHubs([]);
            return;
        }
        const cacheKey = `${locale}:${slug}`;
        const cached = hubCache.current.get(cacheKey);
        if (cached) {
            setHubs(cached);
            return;
        }
        setHubs([]);
        let ignore = false;
        fetchDestinationHubsClient(slug, locale)
            .then(rows => {
                if (ignore) return;
                const mapped = rows
                    .filter(h => h.publishedTourCount >= 3)
                    .map(h => ({
                        name: h.name,
                        slug: h.slug,
                        // The count-less subtitle: what is there, not how many.
                        tagline: h.heroTagline || h.description || null,
                        image: h.heroImage ?? null,
                    }));
                hubCache.current.set(cacheKey, mapped);
                setHubs(mapped);
            })
            .catch(() => {
                if (!ignore) setHubs([]);
            });
        return () => {
            ignore = true;
        };
    }, [currentIsland?.slug, locale]);

    /*
     * The island's CURATED discovery list (SEARCH_PANEL placement) - what the
     * mobile search layer offers before anything is typed.
     *
     * Fetched here rather than passed down from the layout because the active
     * island is a client-side choice that changes without a navigation, exactly
     * like the categories above; same cache-by-island-and-locale, same
     * fail-to-empty. Empty is a MEANINGFUL answer: `buildDiscoveryLinks` reads
     * it as "nothing curated" and falls back to the island's own categories.
     */
    const [popularLinks, setPopularLinks] = useState<DestinationPopularLink[]>(
        []
    );
    const popularCache = useRef<Map<string, DestinationPopularLink[]>>(
        new Map()
    );
    useEffect(() => {
        const slug = currentIsland?.slug;
        if (!slug) {
            setPopularLinks([]);
            return;
        }
        const cacheKey = `${locale}:${slug}`;
        const cached = popularCache.current.get(cacheKey);
        if (cached) {
            setPopularLinks(cached);
            return;
        }
        let ignore = false;
        fetchDestinationPopularLinksClient(slug, locale)
            .then(rows => {
                if (ignore) return;
                popularCache.current.set(cacheKey, rows);
                setPopularLinks(rows);
            })
            .catch(() => {
                if (!ignore) setPopularLinks([]);
            });
        return () => {
            ignore = true;
        };
    }, [currentIsland?.slug, locale]);

    return (
        <header className='fixed top-0 left-0 right-0 z-100 h-16 bg-(--it-navbar-bg) backdrop-blur-[12px] backdrop-saturate-[1.3] shadow-it-navbar'>
            <div className='it-container h-full flex items-center gap-3.5'>
                {/* ── Left: logo + island + categories ── */}
                <div className='flex items-center gap-6 lg:gap-12 shrink-0'>
                    <Link href={localizeHref(locale, '/')} className='shrink-0'>
                        <Image
                            src={logo || '/logo/logo.png'}
                            alt={siteName || 'Island Tours'}
                            width={68}
                            height={50}
                            priority
                            className='h-8 w-auto object-contain md:h-10'
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
                            hubs={hubs}
                            currentIsland={currentIsland}
                            show={!isHome}
                        />
                    </div>

                    {/* Mobile: the island pill sits LEFT, beside the logo
                        (mockup nav order), not in the action cluster. */}
                    <div className='md:hidden'>
                        <DestinationSelector
                            variant='mobile'
                            locale={locale}
                            dict={dict}
                            islands={islands}
                            currentIsland={currentIsland}
                            onOpen={() => setMobileOpen(false)}
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
                    popularLinks={popularLinks}
                    showDesktop={!isHome}
                    mobileOpen={mobileSearchOpen}
                    onMobileClose={() => setMobileSearchOpen(false)}
                />

                {/* ── Desktop right: language + wishlist + account ── */}
                <div className='hidden md:flex items-center gap-5 shrink-0 ml-auto'>
                    <LocaleSelector variant='desktop' locale={locale} dict={dict} />
                    <div className='w-px h-5 bg-it-border' />
                    <WishlistLink locale={locale} dict={dict} />
                    <div className='w-px h-5 bg-it-border' />
                    <AccountMenu locale={locale} dict={dict} />
                </div>

                {/* ── Mobile right: search + language + account + menu ── */}
                <div className='flex md:hidden items-center gap-5 ml-auto'>
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
                            // Hidden while a hero pill is docked right beneath
                            // it (`body.hsdock`, set by `useHeroDock`): the
                            // docked pill IS the search entry there, and two of
                            // them in the same band is what Pastel #51 calls
                            // "a second search bar left behind". Already hidden
                            // on the homepage for the same reason - its hero
                            // owns the search.
                            className='flex items-center bg-transparent border-none cursor-pointer p-0 [.hsdock_&]:hidden'>
                            <Image
                                src='/icons/nav-search.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-5'
                            />
                        </motion.button>
                    )}

                    <LocaleSelector variant='mobile' locale={locale} dict={dict} />

                    <AccountMenu locale={locale} dict={dict} />

                    {/* flex, not the default inline button: without it the
                        icon sits on the TEXT BASELINE, ~3px above the other
                        icons' centers - the reported nav misalignment.
                        `relative` anchors the saved-count badge below. */}
                    <motion.button
                        className='relative flex items-center bg-transparent border-none cursor-pointer p-0 text-it-ink'
                        whileTap={{ scale: 0.9 }}
                        transition={pressSpring}
                        aria-label={mobileOpen ? dict.close : dict.menu}
                        onClick={() => setMobileOpen(v => !v)}>
                        {/* The saved count rides the hamburger on mobile, where
                            the Saved slot itself lives inside the drawer. The
                            badge's whole purpose is PASSIVE visibility, so it
                            has to stay on the bar even when the link it counts
                            does not (client, 2026-08-05). Hidden while the
                            drawer is open - the Saved row is on screen then,
                            and the icon has become a close button. */}
                        <AnimatePresence>
                            {wishlistCount > 0 && !mobileOpen && (
                                <motion.span
                                    key={wishlistCount}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    transition={pressSpring}
                                    aria-hidden
                                    className='absolute -top-2 -right-2 flex h-4 min-w-4 items-center justify-center rounded-it-full bg-it-primary px-1 text-[10px] font-bold leading-none text-it-white tabular-nums'>
                                    {wishlistCount}
                                </motion.span>
                            )}
                        </AnimatePresence>
                        <AnimatePresence mode='wait' initial={false}>
                            <motion.span
                                key={mobileOpen ? 'close' : 'open'}
                                className='inline-flex'
                                initial={{ rotate: -90, opacity: 0 }}
                                animate={{ rotate: 0, opacity: 1 }}
                                exit={{ rotate: 90, opacity: 0 }}
                                transition={{ duration: 0.18 }}>
                                {/* 20px matches the optical weight of the 18px
                                    globe/account icons beside it (24px read as
                                    a size mismatch across the cluster). */}
                                {mobileOpen ? (
                                    <X size={20} strokeWidth={1.5} />
                                ) : (
                                    <Menu size={20} strokeWidth={1.5} />
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
                categories={categories ?? []}
                currentIsland={currentIsland}
                isHome={isHome}
            />
        </header>
    );
}
