'use client';

import { format } from 'date-fns';
import { AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

// Reused presentational typeahead panel (shared with the navbar search). Candidate
// to promote to a shared `search/` folder once a third consumer appears.
import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
import {
    SearchTypeahead,
    type SearchZeroState,
} from '@/components/frontend/navbar/search-typeahead';
import { MobileSearchLayer } from '@/components/frontend/search/mobile-search-layer';
import {
    SearchPill,
    type SearchPillDict,
} from '@/components/frontend/search/search-pill';
import { useHeroDock } from '@/components/frontend/search/use-hero-dock';
import { useIsMobile } from '@/hooks/use-mobile';
import { searchSuggestClient, searchToursClient } from '@/lib/api/search';
import {
    LOCALE_CURRENCY,
    localizeHref,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { currencyFromCookie } from '@/lib/currency/current';
import type {
    SearchHit,
    SuggestCategory,
    SuggestCollection,
    SuggestHub,
} from '@/types/search';

/**
 * Destination hero search - the page's whole search responsibility, split out of
 * the hero shell. Free-text typeahead (matches tour + category titles) scoped to
 * this island, with an optional date that narrows to tours available that day.
 * Submit / "See all" goes to the full results page carrying q + destination +
 * date.
 *
 * THE BAR IS THE SHARED `SearchPill` (Pastel #51) in three positions: over the
 * hero, docked under the nav once the hero scrolls past on mobile, and at the
 * top of the mobile full-screen layer. One component, so the docked pill cannot
 * drift from the hero pill it came from.
 *
 * ON MOBILE THE PANEL IS A FULL-SCREEN LAYER (Pastel #57), not a dropdown: the
 * inline panel had no close control and the keyboard covered all but its first
 * two rows. Desktop keeps the dropdown, which has neither problem.
 */
export function DestinationHeroSearch({
    locale,
    destinationSlug,
    dict,
    search,
    zeroState,
}: {
    locale: Locale;
    destinationSlug: string;
    dict: SearchPillDict;
    search: SearchDict;
    /**
     * What the panel offers BEFORE anything is typed (master 5.10). Built on the
     * server from this island's own gated lists, so every row opens a page that
     * renders.
     */
    zeroState?: SearchZeroState;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [total, setTotal] = useState(0);
    /*
     * Matched pages, not tours. They come from /search/suggest while the tour
     * rows keep coming from the date-aware tour search, because only the latter
     * honours the date field beside the input. Two requests for one panel is
     * the price of a hero search that filters by availability AND offers the
     * category, hub and collection pages behind the words you typed.
     */
    const [entities, setEntities] = useState<{
        categories: SuggestCategory[];
        hubs: SuggestHub[];
        collections: SuggestCollection[];
    }>({ categories: [], hubs: [], collections: [] });
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [dateOpen, setDateOpen] = useState(false);
    /** Mobile only: the full-screen layer, and whether it is showing the calendar. */
    const [layerOpen, setLayerOpen] = useState(false);
    const [layerCalendar, setLayerCalendar] = useState(false);
    const [currency, setCurrency] = useState<Currency>(
        LOCALE_CURRENCY[locale] ?? 'EUR'
    );

    const ref = useRef<HTMLDivElement>(null);
    const layerInputRef = useRef<HTMLInputElement>(null);
    const isMobile = useIsMobile();
    const docked = useHeroDock(ref);
    const trimmed = query.trim();
    // Focus alone is enough to open the panel once there is a zero state to
    // show: the point of 5.10 is the visitor who does not yet know what to type.
    const hasZeroState =
        !!zeroState &&
        zeroState.categoriesAndHubs.length + zeroState.collections.length > 0;
    const showPanel = focused && (trimmed.length >= 2 || hasZeroState);
    const isoDate = date ? format(date, 'yyyy-MM-dd') : undefined;

    // Sync display currency from the cookie on mount (client-only, no SSR mismatch).
    useEffect(() => {
        setCurrency(currencyFromCookie(document.cookie, locale));
    }, [locale]);

    /*
     * Close the typeahead on an outside pointerdown.
     *
     * THE DATE POPOVER IS PORTALLED TO `document.body`, so `ref` does not
     * contain it and every click on a calendar day counted as "outside". The
     * comment here used to claim the opposite, and the bug was exactly what
     * that wrong claim predicted would not happen: with the panel open, the
     * FIRST click on a day only closed the panel and the day had to be clicked
     * again. A date picker that needs two clicks the first time and one
     * thereafter is not a picker anyone can learn.
     *
     * So a portalled overlay counts as inside. `data-slot="popover-content"` is
     * what `components/ui/popover` stamps on it, and the dialog role covers the
     * mobile layer for the same reason.
     */
    useEffect(() => {
        if (!focused) return;
        function onPointerDown(event: PointerEvent) {
            const target = event.target as Element | null;
            if (
                target?.closest?.(
                    '[data-slot="popover-content"],[role="dialog"]'
                )
            ) {
                return;
            }
            if (ref.current && !ref.current.contains(target)) {
                setFocused(false);
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, [focused]);

    // The layer's field takes focus on open, so the keyboard comes up against
    // the list rather than the visitor having to tap a second time.
    useEffect(() => {
        if (layerOpen && !layerCalendar) layerInputRef.current?.focus();
    }, [layerOpen, layerCalendar]);

    // Live previews as the user types (debounced 250ms, abortable). Re-runs when
    // the date changes so the preview reflects availability.
    useEffect(() => {
        const q = query.trim();
        if (q.length < 2) {
            setHits([]);
            setTotal(0);
            setEntities({ categories: [], hubs: [], collections: [] });
            setLoading(false);
            return;
        }
        setLoading(true);
        const controller = new AbortController();
        const timer = setTimeout(() => {
            // Together, not one after the other - the panel needs both before
            // it is complete, and neither depends on the other.
            Promise.all([
                searchToursClient(
                    {
                        q,
                        locale,
                        currency,
                        destinationSlug,
                        date: isoDate,
                        limit: 6,
                    },
                    controller.signal
                ),
                searchSuggestClient(
                    { q, locale, currency, destinationSlug },
                    controller.signal
                ),
            ])
                .then(([tours, suggest]) => {
                    setHits(tours.data);
                    setTotal(tours.total);
                    setEntities({
                        categories: suggest.categories,
                        hubs: suggest.hubs,
                        collections: suggest.collections ?? [],
                    });
                    setLoading(false);
                })
                .catch(() => setLoading(false));
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [query, locale, currency, destinationSlug, isoDate]);

    const searchHref = (q: string) => {
        const sp = new URLSearchParams({ q });
        sp.set('destination', destinationSlug);
        if (isoDate) sp.set('date', isoDate);
        return `${localizeHref(locale, '/search')}?${sp.toString()}`;
    };

    /*
     * Tour links carry the chosen day. The panel is already filtered to tours
     * bookable that date, so landing on one and being asked to pick a date
     * again - or worse, being shown a different day's price - throws away the
     * answer the traveller just gave. The widget preselects it and stays
     * editable.
     */
    const tourHref = (hit: SearchHit) =>
        hit.destinationSlug
            ? localizeHref(
                  locale,
                  `/${hit.destinationSlug}/${hit.slug}${isoDate ? `?date=${isoDate}` : ''}`
              )
            : localizeHref(
                  locale,
                  `/search?q=${encodeURIComponent(hit.title)}`
              );

    /**
     * The island's All Tours page, carrying the date as a pre-applied filter.
     * `tours` is reserved at every destination in the slug registry, so this
     * path can never collide with a category, hub or collection.
     */
    const allToursHref = () =>
        `${localizeHref(locale, `/${destinationSlug}/tours`)}${
            isoDate ? `?date=${isoDate}` : ''
        }`;

    /**
     * EITHER field alone is a valid search - the two are not a compound key.
     *
     *  - An activity (with or without a date) goes to /search, which is the
     *    query engine and the only thing that can rank a keyword.
     *  - No activity goes to All Tours instead, with any date pre-applied.
     *    "What can I do on Thursday" has nothing to rank, and that page already
     *    filters on date availability and renders the date as a removable chip,
     *    so it answers the question better than a keyword-less /search could.
     *
     * Submitting empty used to be a silent no-op - a button that visibly does
     * nothing. It now lands on All Tours, which is the same rule with no date.
     */
    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFocused(false);
        closeLayer();
        router.push(trimmed ? searchHref(trimmed) : allToursHref());
    }

    function closeLayer() {
        setLayerOpen(false);
        setLayerCalendar(false);
    }

    const panel = (inline: boolean) => (
        <SearchTypeahead
            // Tour rows come from the date-aware tour search; the entity rows
            // from /search/suggest. `beyondTours` stays empty on purpose - this
            // search is scoped to the island whose page you are on.
            suggest={{
                query: trimmed,
                total,
                categories: entities.categories,
                hubs: entities.hubs,
                collections: entities.collections,
                tours: hits,
                beyondTours: [],
            }}
            loading={loading}
            query={trimmed}
            locale={locale}
            currency={currency}
            dict={search}
            islandName={null}
            searchHref={searchHref}
            tourHref={tourHref}
            categoryHref={slug =>
                localizeHref(locale, `/${destinationSlug}/${slug}`)
            }
            hubHref={(destSlug, slug) => localizeHref(locale, `/${destSlug}/${slug}`)}
            zeroState={zeroState}
            inline={inline}
            onSelect={() => {
                setFocused(false);
                closeLayer();
            }}
        />
    );

    return (
        <div ref={ref} className='relative w-full'>
            {/* Docked (mobile, hero scrolled past): the same pill, fixed under
                the nav inside a 12px gutter. No spacer is left behind - by the
                time it docks the hero is off screen, so there is nothing to
                hold open. */}
            <div
                className={
                    docked
                        ? 'fixed left-3 right-3 top-[72px] z-60 md:static md:z-auto'
                        : undefined
                }>
                <SearchPill
                    variant={docked ? 'docked' : 'hero'}
                    dict={dict}
                    compact={isMobile}
                    query={query}
                    onQueryChange={setQuery}
                    onFocus={() => setFocused(true)}
                    date={date}
                    onDateChange={setDate}
                    dateOpen={dateOpen}
                    onDateOpenChange={setDateOpen}
                    onSubmit={submit}
                    // Mobile taps hand off to the layer instead of focusing in
                    // place; desktop keeps the inline dropdown.
                    onOpenLayer={target => {
                        setLayerCalendar(target === 'date');
                        setLayerOpen(true);
                    }}
                />
            </div>

            {/* Desktop dropdown. Hidden below md, where the layer owns it. */}
            <AnimatePresence>
                {showPanel && (
                    <div className='max-md:hidden'>{panel(false)}</div>
                )}
            </AnimatePresence>

            <MobileSearchLayer
                open={layerOpen}
                onClose={closeLayer}
                closeLabel={search.closeSearch}
                calendarOpen={layerCalendar}
                date={date}
                onDateSelect={selected => {
                    setDate(selected);
                    setLayerCalendar(false);
                }}
                pill={
                    <SearchPill
                        ref={layerInputRef}
                        variant='layer'
                        dict={dict}
                        compact
                        query={query}
                        onQueryChange={value => {
                            setQuery(value);
                            setLayerCalendar(false);
                        }}
                        // Tapping back into the field is a change of mind about
                        // WHICH question is being answered, so the calendar
                        // gives the space back to the suggestions - waiting for
                        // a keystroke would leave the visitor typing behind a
                        // calendar.
                        onFocus={() => setLayerCalendar(false)}
                        date={date}
                        onDateChange={setDate}
                        // Inside the layer the calendar replaces the list in
                        // the same space rather than opening a popover over it.
                        inlineCalendar
                        dateOpen={layerCalendar}
                        onDateOpenChange={setLayerCalendar}
                        onSubmit={submit}
                    />
                }
                panel={panel(true)}
            />
        </div>
    );
}
