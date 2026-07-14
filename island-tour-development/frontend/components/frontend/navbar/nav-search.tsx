'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { searchToursClient } from '@/lib/api/search';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { SearchHit } from '@/types/search';

import { iconPress, pressSpring } from './lib/navbar.constants';
import type { Island, NavDict, SearchDict } from './lib/navbar.types';
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
    showDesktop,
    mobileOpen,
    onMobileClose,
}: {
    locale: Locale;
    nav: NavDict;
    search: SearchDict;
    currentIsland: Island | null;
    showDesktop: boolean;
    mobileOpen: boolean;
    onMobileClose: () => void;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);

    const desktopRef = useRef<HTMLDivElement>(null);
    const mobileInputRef = useRef<HTMLInputElement>(null);

    const trimmed = query.trim();
    const showDesktopPanel = focused && trimmed.length >= 2;

    useClickOutside(desktopRef, () => setFocused(false), focused);

    // Live previews as the user types (debounced 250ms, abortable).
    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setHits([]);
            setTotal(0);
            setLoading(false);
            return;
        }
        setLoading(true);
        const controller = new AbortController();
        const timer = setTimeout(() => {
            searchToursClient(
                { q, locale, destinationSlug: currentIsland?.slug, limit: 6 },
                controller.signal
            )
                .then(res => {
                    setHits(res.data);
                    setTotal(res.total);
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, locale, currentIsland?.slug]);

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

    const panel = (
        <SearchTypeahead
            hits={hits}
            total={total}
            loading={loading}
            query={trimmed}
            dict={search}
            searchHref={searchHref}
            tourHref={tourHref}
            onSelect={onSelect}
        />
    );

    return (
        <>
            {/* Desktop pill - fills the middle of the bar on inner pages. */}
            {showDesktop && (
                <div
                    ref={desktopRef}
                    className='relative hidden md:block flex-1 max-w-141.25'>
                    <form
                        onSubmit={submit}
                        role='search'
                        className='flex w-full items-center gap-2 rounded-it-full border border-it-heading/20 px-4 py-3 bg-it-white transition-colors duration-300 focus-within:border-it-heading/40'>
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
                        <input
                            type='search'
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onFocus={() => setFocused(true)}
                            placeholder={nav.search}
                            aria-label={nav.search}
                            className='flex-1 min-w-0 bg-transparent border-none outline-none text-base text-it-heading placeholder:text-it-text-muted [&::-webkit-search-cancel-button]:appearance-none'
                        />
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
                            <input
                                ref={mobileInputRef}
                                type='search'
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder={nav.search}
                                aria-label={nav.search}
                                className='flex-1 min-w-0 bg-transparent border-none outline-none text-base text-it-heading placeholder:text-it-text-muted [&::-webkit-search-cancel-button]:appearance-none'
                            />
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
