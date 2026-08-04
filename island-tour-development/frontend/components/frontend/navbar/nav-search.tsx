'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { searchSuggestClient } from '@/lib/api/search';
import {
    localizeHref,
    LOCALE_CURRENCY,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { currencyFromCookie } from '@/lib/currency/current';
import type { SearchHit, SearchSuggest } from '@/types/search';

import { iconPress, pressSpring } from './lib/navbar.constants';
import type { Category, Island, NavDict, SearchDict } from './lib/navbar.types';
import { RotatingSearchPlaceholder } from './rotating-search-placeholder';
import { SearchTypeahead } from './search-typeahead';
import { useClickOutside } from './lib/use-click-outside';

/**
 * The whole search responsibility: the always-visible desktop pill (inner pages
 * only) and the tap-to-expand mobile overlay, both bound to one debounced,
 * abortable typeahead. Enter / "See all" navigates to the full results page,
 * scoped to the active island when one is set.
 *
 * The mobile overlay is controlled by the parent (`mobileOpen` / `onMobileClose`)
 * because its trigger lives in the navbar's mobile action cluster.
 */
export function NavSearch({
    locale,
    nav,
    search,
    currentIsland,
    categories,
    showDesktop,
    mobileOpen,
    onMobileClose,
}: {
    locale: Locale;
    nav: NavDict;
    search: SearchDict;
    currentIsland: Island | null;
    /** Destination-scoped categories - feed the rotating placeholder. */
    categories: Category[] | null;
    showDesktop: boolean;
    mobileOpen: boolean;
    onMobileClose: () => void;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [suggest, setSuggest] = useState<SearchSuggest | null>(null);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
    // Display currency for the typeahead prices. Starts from the locale default
    // (matches SSR) and syncs to the shopper's cookie once mounted.
    const [currency, setCurrency] = useState<Currency>(
        LOCALE_CURRENCY[locale] ?? 'EUR'
    );

    const desktopRef = useRef<HTMLDivElement>(null);
    const mobileInputRef = useRef<HTMLInputElement>(null);

    const trimmed = query.trim();
    const showDesktopPanel = focused && trimmed.length >= 2;

    useClickOutside(desktopRef, () => setFocused(false), focused);

    // Resolve the shopper currency from the cookie on mount (client-only, so it
    // never causes a hydration mismatch against the locale-default initial state).
    useEffect(() => {
        setCurrency(currencyFromCookie(document.cookie, locale));
    }, [locale]);

    // Live suggestions as the user types (debounced 250ms, abortable).
    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setSuggest(null);
            setLoading(false);
            return;
        }
        setLoading(true);
        const controller = new AbortController();
        const timer = setTimeout(() => {
            searchSuggestClient(
                {
                    q,
                    locale,
                    currency,
                    destinationSlug: currentIsland?.slug,
                },
                controller.signal
            )
                .then(res => {
                    setSuggest(res);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, locale, currency, currentIsland?.slug]);

    // Focus the mobile field as soon as the overlay expands.
    useEffect(() => {
        if (mobileOpen) mobileInputRef.current?.focus();
    }, [mobileOpen]);

    // Results-page URL, scoped to the active island when one is set.
    const searchHref = (q: string) => {
        const base = `${localizeHref(locale, '/search')}?q=${encodeURIComponent(q)}`;
        return currentIsland ? `${base}&destination=${currentIsland.slug}` : base;
    };

    const tourHref = (hit: SearchHit) =>
        hit.destinationSlug
            ? localizeHref(locale, `/${hit.destinationSlug}/${hit.slug}`)
            : localizeHref(locale, `/search?q=${encodeURIComponent(hit.title)}`);

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const q = query.trim();
        if (!q) return;
        onMobileClose();
        setFocused(false);
        router.push(searchHref(q));
    }

    const onSelect = () => {
        setFocused(false);
        onMobileClose();
    };

    // Fever-style placeholder: "Search for" + rotating category names of the
    // active island. Falls back to the plain placeholder attr when there are
    // no categories to rotate.
    const categoryNames = (categories ?? []).map(c => c.name);
    const rotating = categoryNames.length > 0;

    const panel = (
        <SearchTypeahead
            suggest={suggest}
            loading={loading}
            query={trimmed}
            locale={locale}
            currency={currency}
            dict={search}
            islandName={currentIsland?.name ?? null}
            searchHref={searchHref}
            tourHref={tourHref}
            categoryHref={
                currentIsland
                    ? (slug: string) =>
                          localizeHref(
                              locale,
                              `/${currentIsland.slug}/${slug}`
                          )
                    : null
            }
            hubHref={(destinationSlug: string, slug: string) =>
                localizeHref(locale, `/${destinationSlug}/${slug}`)
            }
            onSelect={onSelect}
        />
    );

    return (
        <>
            {/* Desktop pill - fills the middle of the bar on inner pages. */}
            {showDesktop && (
                <div
                    ref={desktopRef}
                    className='relative hidden md:block w-full min-w-[180px] max-w-[420px]'>
                    {/* Compact scoped pill (design v2 .navsearch): paper
                        surface, hairline border, faint 16px magnifier. */}
                    <form
                        onSubmit={submit}
                        role='search'
                        className='flex w-full items-center gap-2 rounded-it-full border border-it-border bg-it-bg px-4 py-[9px] transition-colors duration-(--it-duration-xs) ease-(--it-ease) focus-within:border-it-ink-muted'>
                        <motion.button
                            type='submit'
                            aria-label={nav.search}
                            {...iconPress}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                            <Image
                                src='/icons/search-faint.svg'
                                alt=''
                                width={16}
                                height={16}
                                className='size-4 shrink-0'
                            />
                        </motion.button>
                        <span className='relative flex-1 min-w-0'>
                            <input
                                type='search'
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                onFocus={() => setFocused(true)}
                                placeholder={rotating ? '' : nav.search}
                                aria-label={nav.search}
                                className='w-full bg-transparent border-none outline-none text-[13.5px] font-semibold text-it-ink placeholder:font-medium placeholder:text-it-ink-muted [&::-webkit-search-cancel-button]:appearance-none'
                            />
                            {rotating && query === '' && (
                                <RotatingSearchPlaceholder
                                    prefix={nav.search}
                                    names={categoryNames}
                                />
                            )}
                        </span>
                    </form>
                    <AnimatePresence>
                        {showDesktopPanel && panel}
                    </AnimatePresence>
                </div>
            )}

            {/* Mobile overlay - expands over the bar when the search icon is tapped. */}
            <AnimatePresence>
                {mobileOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className='absolute inset-0 z-50 flex items-center gap-3 bg-it-white px-4 md:hidden'>
                        <motion.button
                            type='button'
                            onClick={onMobileClose}
                            aria-label={nav.close}
                            whileTap={{ scale: 0.9, x: -2 }}
                            transition={pressSpring}
                            className='flex items-center bg-transparent border-none cursor-pointer p-0 text-it-heading'>
                            <ArrowLeft size={24} strokeWidth={1.5} />
                        </motion.button>
                        <form
                            onSubmit={submit}
                            role='search'
                            className='flex flex-1 items-center gap-2 rounded-it-full border border-it-heading-subtle px-4 py-2.5 bg-it-white'>
                            <span className='relative flex-1 min-w-0'>
                                <input
                                    ref={mobileInputRef}
                                    type='search'
                                    value={query}
                                    onChange={e => setQuery(e.target.value)}
                                    placeholder={rotating ? '' : nav.search}
                                    aria-label={nav.search}
                                    className='w-full bg-transparent border-none outline-none text-[15px] font-semibold text-it-ink placeholder:font-medium placeholder:text-it-ink-muted [&::-webkit-search-cancel-button]:appearance-none'
                                />
                                {rotating && query === '' && (
                                    <RotatingSearchPlaceholder
                                        prefix={nav.search}
                                        names={categoryNames}
                                    />
                                )}
                            </span>
                            <motion.button
                                type='submit'
                                aria-label={nav.search}
                                {...iconPress}
                                className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                                <Image
                                    src='/icons/nav-search.svg'
                                    alt=''
                                    width={18}
                                    height={18}
                                    className='size-4.5 shrink-0'
                                />
                            </motion.button>
                        </form>
                        {trimmed.length >= 2 && panel}
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
