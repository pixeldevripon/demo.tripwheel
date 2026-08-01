'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

// Reused presentational typeahead panel (shared with the navbar + destination
// hero searches) so all three surface identical result rows.
import { SearchTypeahead } from '@/components/frontend/navbar/search-typeahead';
import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
import { searchSuggestClient } from '@/lib/api/search';
import {
    localizeHref,
    LOCALE_CURRENCY,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { currencyFromCookie } from '@/lib/currency/current';
import { springPop } from '@/lib/motion';
import type { SearchHit, SearchSuggest } from '@/types/search';

import type { HeroDestination } from './lib/hero.types';

/** Diacritic-insensitive lowercase, so "curacao" matches "Curaçao". */
const normalize = (value: string) =>
    value
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase();

/**
 * Homepage hero search - the same typeahead as the navbar/destination searches
 * (tours, hubs, see-all), but with destination matches always on top: islands
 * are the homepage's priority, so a focused empty field lists them all and
 * Enter goes to the top island match before falling back to the results page.
 */
export function HeroSearch({
    destinations,
    locale,
    placeholder,
    search,
}: {
    destinations: HeroDestination[];
    locale: Locale;
    placeholder: string;
    search: SearchDict;
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
    const ref = useRef<HTMLDivElement>(null);

    const trimmed = query.trim();

    const islandMatches = useMemo(() => {
        const q = normalize(trimmed);
        if (!q) return destinations;
        return destinations.filter(d => normalize(d.name).includes(q));
    }, [trimmed, destinations]);

    useEffect(() => {
        setCurrency(currencyFromCookie(document.cookie, locale));
    }, [locale]);

    // Close the panel on an outside pointerdown.
    useEffect(() => {
        if (!focused) return;
        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setFocused(false);
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [focused]);

    // Live suggestions as the user types (debounced 250ms, abortable). Global
    // scope - the homepage has no active island.
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
            searchSuggestClient({ q, locale, currency }, controller.signal)
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
    }, [query, locale, currency]);

    const searchHref = (q: string) =>
        `${localizeHref(locale, '/search')}?q=${encodeURIComponent(q)}`;

    const tourHref = (hit: SearchHit) =>
        hit.destinationSlug
            ? localizeHref(locale, `/${hit.destinationSlug}/${hit.slug}`)
            : localizeHref(locale, `/search?q=${encodeURIComponent(hit.title)}`);

    const destinationHref = (slug: string) => localizeHref(locale, `/${slug}`);

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFocused(false);
        // Destinations first: Enter lands on the top island match when there is
        // one, otherwise on the full results page.
        const topIsland = islandMatches[0];
        if (topIsland) {
            router.push(destinationHref(topIsland.slug));
        } else if (trimmed.length >= 2) {
            router.push(searchHref(trimmed));
        }
    }

    const showPanel =
        focused && (islandMatches.length > 0 || trimmed.length >= 2);

    return (
        <div ref={ref} className='relative w-full'>
            <form
                onSubmit={submit}
                role='search'
                className='flex items-center justify-between gap-2 w-full bg-it-white border border-it-white/70 rounded-it-full h-14 md:h-[62px] pl-3.5 md:pl-[22px] pr-2 shadow-[0_18px_44px_rgba(0,0,0,0.3)]'>
                <div className='flex items-center gap-2 flex-1 min-w-0'>
                    <Image
                        src='/icons/hero-location.svg'
                        alt=''
                        width={24}
                        height={24}
                        className='size-5 shrink-0'
                    />
                    <input
                        type='text'
                        value={query}
                        onChange={e => {
                            setQuery(e.target.value);
                            setFocused(true);
                        }}
                        onFocus={() => setFocused(true)}
                        placeholder={placeholder}
                        aria-label={placeholder}
                        className='flex-1 min-w-0 border-none outline-none bg-transparent text-[15px] md:text-[16.5px] font-semibold text-it-ink placeholder:font-semibold placeholder:text-it-ink-muted'
                    />
                </div>
                <motion.button
                    type='submit'
                    aria-label={search.title}
                    className='shrink-0 flex items-center justify-center gap-2 h-10 md:h-12 px-4 md:px-[26px] rounded-it-full bg-it-primary hover:bg-it-primary-hover transition-colors border-none cursor-pointer'
                    initial='rest'
                    whileTap='tap'
                    animate='rest'
                    variants={{ rest: { scale: 1 }, tap: { scale: 0.97 } }}
                    transition={springPop}>
                    <motion.span
                        className='inline-flex'
                        variants={{ rest: { x: 0 }, tap: { x: 3 } }}
                        transition={springPop}>
                        <Image
                            src='/icons/hero-search-white.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-4.5'
                        />
                    </motion.span>
                    <span className='text-[15px] md:text-[16px] font-bold text-it-white'>
                        {search.title}
                    </span>
                </motion.button>
            </form>

            <AnimatePresence>
                {showPanel && (
                    <SearchTypeahead
                        suggest={suggest}
                        loading={loading}
                        query={trimmed}
                        locale={locale}
                        currency={currency}
                        dict={search}
                        islandName={null}
                        searchHref={searchHref}
                        tourHref={tourHref}
                        categoryHref={null}
                        hubHref={(destSlug, slug) =>
                            localizeHref(locale, `/${destSlug}/${slug}`)
                        }
                        destinations={islandMatches}
                        destinationHref={destinationHref}
                        onSelect={() => setFocused(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
