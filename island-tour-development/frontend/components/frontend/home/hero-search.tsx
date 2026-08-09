'use client';

import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

// Reused presentational typeahead panel (shared with the navbar + destination
// hero searches) so all three surface identical result rows.
import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
import { SearchTypeahead } from '@/components/frontend/navbar/search-typeahead';
import { MobileSearchLayer } from '@/components/frontend/search/mobile-search-layer';
import { SearchPill } from '@/components/frontend/search/search-pill';
import { useIsMobile } from '@/hooks/use-mobile';
import { searchSuggestClient } from '@/lib/api/search';
import {
    LOCALE_CURRENCY,
    localizeHref,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { currencyFromCookie } from '@/lib/currency/current';
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
    /** Mobile only: the shared full-screen search layer (Pastel #57). */
    const [layerOpen, setLayerOpen] = useState(false);
    // Display currency for the typeahead prices. Starts from the locale default
    // (matches SSR) and syncs to the shopper's cookie once mounted.
    const [currency, setCurrency] = useState<Currency>(
        LOCALE_CURRENCY[locale] ?? 'EUR'
    );
    const ref = useRef<HTMLDivElement>(null);
    const layerInputRef = useRef<HTMLInputElement>(null);
    const isMobile = useIsMobile();

    const trimmed = query.trim();

    const islandMatches = useMemo(() => {
        const q = normalize(trimmed);
        if (!q) return destinations;
        return destinations.filter(d => normalize(d.name).includes(q));
    }, [trimmed, destinations]);

    useEffect(() => {
        setCurrency(currencyFromCookie(document.cookie, locale));
    }, [locale]);

    // Focus the layer's field on open, so the keyboard rises against the list.
    useEffect(() => {
        if (layerOpen) layerInputRef.current?.focus();
    }, [layerOpen]);

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
            : localizeHref(
                  locale,
                  `/search?q=${encodeURIComponent(hit.title)}`
              );

    const destinationHref = (slug: string) => localizeHref(locale, `/${slug}`);

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFocused(false);
        setLayerOpen(false);
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

    const pillDict = {
        searchPlaceholder: placeholder,
        // The homepage asks one short question already ("Which island?"), so
        // there is nothing to shorten on mobile.
        searchPlaceholderShort: placeholder,
        searchLabel: search.title,
    };

    const panel = (inline: boolean) => (
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
            hubHref={(destSlug, slug) => localizeHref(locale, `/${destSlug}/${slug}`)}
            destinations={islandMatches}
            destinationHref={destinationHref}
            inline={inline}
            onSelect={() => {
                setFocused(false);
                setLayerOpen(false);
            }}
        />
    );

    return (
        <div ref={ref} className='relative w-full'>
            {/* THE SAME PILL AS THE DESTINATION HERO (Pastel #51 requires it),
                minus the date half: this field searches ISLANDS, and "which
                island, on which day" is not a question the homepage can answer -
                availability is per tour, and there is no island chosen yet. */}
            <SearchPill
                dict={pillDict}
                // Without `compact` the pill never hands off (`handOff` gates on
                // it), so mobile taps focused the field in place and the panel -
                // `max-md:hidden` below - never appeared anywhere.
                compact={isMobile}
                query={query}
                onQueryChange={value => {
                    setQuery(value);
                    setFocused(true);
                }}
                onFocus={() => setFocused(true)}
                showDate={false}
                icon='/icons/hero-location.svg'
                onSubmit={submit}
                onOpenLayer={() => setLayerOpen(true)}
            />

            {/* Desktop dropdown; below md the layer owns it. */}
            <AnimatePresence>
                {showPanel && <div className='max-md:hidden'>{panel(false)}</div>}
            </AnimatePresence>

            <MobileSearchLayer
                open={layerOpen}
                onClose={() => setLayerOpen(false)}
                closeLabel={search.closeSearch}
                pill={
                    <SearchPill
                        ref={layerInputRef}
                        variant='layer'
                        dict={pillDict}
                        compact
                        query={query}
                        onQueryChange={setQuery}
                        showDate={false}
                        icon='/icons/hero-location.svg'
                        onSubmit={submit}
                    />
                }
                panel={panel(true)}
            />
        </div>
    );
}
