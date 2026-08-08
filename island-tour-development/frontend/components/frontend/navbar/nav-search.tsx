'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { MobileSearchLayer } from '@/components/frontend/search/mobile-search-layer';
import { SearchPill } from '@/components/frontend/search/search-pill';
import { searchSuggestClient } from '@/lib/api/search';
import {
    LOCALE_CURRENCY,
    localizeHref,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { currencyFromCookie } from '@/lib/currency/current';
import type { SearchHit, SearchSuggest } from '@/types/search';

import { iconPress } from './lib/navbar.constants';
import type { Category, Island, NavDict, SearchDict } from './lib/navbar.types';
import { useClickOutside } from './lib/use-click-outside';
import { RotatingSearchPlaceholder } from './rotating-search-placeholder';
import { SearchTypeahead } from './search-typeahead';

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
                { q, locale, currency, destinationSlug: currentIsland?.slug },
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

    // Focus the layer's field as soon as it opens, so the keyboard comes up
    // against the list rather than needing a second tap.
    useEffect(() => {
        if (mobileOpen) mobileInputRef.current?.focus();
    }, [mobileOpen]);

    // Results-page URL, scoped to the active island when one is set.
    const searchHref = (q: string) => {
        const base = `${localizeHref(locale, '/search')}?q=${encodeURIComponent(q)}`;
        return currentIsland
            ? `${base}&destination=${currentIsland.slug}`
            : base;
    };

    const tourHref = (hit: SearchHit) =>
        hit.destinationSlug
            ? localizeHref(locale, `/${hit.destinationSlug}/${hit.slug}`)
            : localizeHref(
                  locale,
                  `/search?q=${encodeURIComponent(hit.title)}`
              );

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

    /*
     * What the LAYER offers before anything is typed. The dropdown can afford
     * to stay closed until two characters - it is a small panel under a small
     * bar - but the layer is a whole screen, and it opened on "No results for
     * “”", which is a verdict on a search nobody had run.
     *
     * Built from the island's own categories, the same list the rotating
     * placeholder cycles, so the words the field is suggesting are the rows
     * underneath it. Unscoped (no island) there is nothing gated to offer, and
     * the layer simply waits for a query.
     */
    const layerZeroState =
        currentIsland && (categories?.length ?? 0) > 0
            ? {
                  categoriesAndHubs: (categories ?? []).map(category => ({
                      name: category.name,
                      href: localizeHref(
                          locale,
                          `/${currentIsland.slug}/${category.slug}`
                      ),
                      kind: 'category' as const,
                      tours: category.tours,
                      image: category.image,
                  })),
                  collections: [],
                  topTours: [],
                  allTours: null,
              }
            : undefined;

    const panel = (inline: boolean) => (
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
                          localizeHref(locale, `/${currentIsland.slug}/${slug}`)
                    : null
            }
            hubHref={(destinationSlug: string, slug: string) =>
                localizeHref(locale, `/${destinationSlug}/${slug}`)
            }
            zeroState={inline ? layerZeroState : undefined}
            inline={inline}
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
                                className='w-full bg-transparent border-none outline-none text-[16px] md:text-[13.5px] font-semibold text-it-ink placeholder:font-bold placeholder:text-it-ink-muted [&::-webkit-search-cancel-button]:appearance-none'
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
                        {showDesktopPanel && panel(false)}
                    </AnimatePresence>
                </div>
            )}

            {/* Mobile: the SHARED full-screen layer (Pastel #57), not a
                second panel. The nav icon and the hero pill are two ways into
                one component - the issue is explicit that the nav must not grow
                its own. What it replaced was an in-bar overlay whose only exit
                was a back arrow and whose suggestions were still an inline
                dropdown under it, so the keyboard covered them exactly as it
                did in the hero. */}
            <MobileSearchLayer
                open={mobileOpen}
                onClose={onMobileClose}
                closeLabel={search.closeSearch}
                pill={
                    <SearchPill
                        ref={mobileInputRef}
                        variant='layer'
                        compact
                        dict={{
                            // Blank while the rotating overlay is running, so
                            // the two do not print on top of each other.
                            searchPlaceholder: rotating ? '' : nav.search,
                            searchPlaceholderShort: rotating ? '' : nav.search,
                            ariaLabel: nav.search,
                            searchLabel: search.title,
                        }}
                        query={query}
                        onQueryChange={setQuery}
                        // NO DATE. The navbar search never had one and gaining
                        // one from the shared pill would be a feature nobody
                        // asked for - the date belongs to the hero, where the
                        // island is already chosen.
                        showDate={false}
                        onSubmit={submit}>
                        {rotating && query === '' && (
                            <RotatingSearchPlaceholder
                                prefix={nav.search}
                                names={categoryNames}
                            />
                        )}
                    </SearchPill>
                }
                panel={panel(true)}
            />

        </>
    );
}

