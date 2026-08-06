'use client';

import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
// Reused presentational typeahead panel (shared with the navbar search). Candidate
// to promote to a shared `search/` folder once a third consumer appears.
import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
import {
    SearchTypeahead,
    type SearchZeroState,
} from '@/components/frontend/navbar/search-typeahead';
import { searchSuggestClient, searchToursClient } from '@/lib/api/search';
import {
    LOCALE_CURRENCY,
    localizeHref,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { currencyFromCookie } from '@/lib/currency/current';
import { springPop } from '@/lib/motion';
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
    dict: { searchPlaceholder: string; selectDate: string; clearDate: string };
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
    const [currency, setCurrency] = useState<Currency>(
        LOCALE_CURRENCY[locale] ?? 'EUR'
    );

    const ref = useRef<HTMLDivElement>(null);
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

    // Close the typeahead on an outside pointerdown (the date popover is portalled,
    // so clicks inside it don't count as outside).
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
        router.push(trimmed ? searchHref(trimmed) : allToursHref());
    }

    return (
        <div ref={ref} className='relative w-full'>
            <form
                onSubmit={submit}
                role='search'
                className='flex w-full gap-2 rounded-it-lg bg-it-white p-2 shadow-[0_18px_44px_rgba(0,0,0,0.3)] max-md:flex-col max-md:gap-1.5'>
                {/* Search field (design v2 .hs-field): icon + text, the whole
                    region focuses the input. Text is 16px below `md`: iOS
                    Safari force-zooms the entire viewport when a focused input
                    computes under 16px, and never zooms back out - which is
                    the Pastel #29 report against this exact field. The date
                    control beside it is a button, so it never triggered the
                    zoom; it is bumped only to keep the pill's two halves
                    type-matched. */}
                <label className='flex min-w-0 flex-1 cursor-text items-center gap-2.5 rounded-it-sm py-2.5 pl-3.5 pr-2 transition-colors hover:bg-it-bg'>
                    <Image
                        src='/icons/search-soft.svg'
                        alt=''
                        width={24}
                        height={24}
                        className='size-4.5 shrink-0'
                    />
                    <input
                        type='search'
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onFocus={() => setFocused(true)}
                        placeholder={dict.searchPlaceholder}
                        aria-label={dict.searchPlaceholder}
                        className='min-w-0 w-full bg-transparent border-none outline-none text-[16px] md:text-[15.5px] font-semibold leading-[1.6] text-it-ink placeholder:font-bold placeholder:text-it-ink-muted [&::-webkit-search-cancel-button]:appearance-none'
                    />
                </label>

                {/* Vertical divider between the two fields (desktop only). */}
                <span className='my-1.5 w-px shrink-0 bg-it-divider max-md:hidden' />

                {/* Date picker - "Select date" text on both mobile and desktop.
                    h-full + flex-1 on desktop (absorbing the old spacer): the
                    whole region between the divider and the action button opens
                    the calendar. */}
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    {/* Clear control as a SIBLING of the trigger - a button's
                        descendants are presentational to the accessibility
                        tree, so a nested control would be unreachable. With no
                        date the trigger absorbs the whole region (flex-1);
                        with one it hugs the text so the clear sits beside it. */}
                    <div className='flex shrink-0 items-center gap-1.5 rounded-it-sm transition-colors hover:bg-it-bg md:w-[190px]'>
                        <PopoverTrigger asChild>
                            <motion.button
                                type='button'
                                aria-label={dict.selectDate}
                                transition={springPop}
                                className={`flex flex-1 cursor-pointer items-center gap-2.5 whitespace-nowrap border-none bg-transparent py-2.5 pl-3.5 pr-2 text-left text-[16px] md:text-[15.5px] leading-[1.6] transition-colors duration-300 ${date ? 'font-semibold text-it-ink' : 'font-bold text-it-ink-muted'}`}>
                                <Image
                                    src='/icons/calendar-soft.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-4.5 shrink-0'
                                />
                                {date
                                    ? format(date, 'd MMM yyyy')
                                    : dict.selectDate}
                            </motion.button>
                        </PopoverTrigger>
                        {date && (
                            <motion.button
                                type='button'
                                aria-label={dict.clearDate}
                                whileTap={{ scale: 0.9 }}
                                transition={springPop}
                                onClick={() => setDate(undefined)}
                                className='grid h-full shrink-0 cursor-pointer place-items-center border-none bg-transparent p-0'>
                                <Image
                                    src='/icons/filters/close-circle.svg'
                                    alt=''
                                    width={20}
                                    height={20}
                                    className='size-5 shrink-0'
                                />
                            </motion.button>
                        )}
                    </div>
                    <PopoverContent
                        align='start'
                        sideOffset={28}
                        className='w-auto rounded-[8px] bg-it-white p-0 text-it-heading duration-300 ease-[cubic-bezier(0.21,0.47,0.32,0.98)]'>
                        <Calendar
                            mode='single'
                            selected={date}
                            onSelect={selected => {
                                setDate(selected);
                                setDateOpen(false);
                            }}
                            disabled={{ before: new Date() }}
                            autoFocus
                            className='bg-it-white [--cell-radius:8px]'
                        />
                    </PopoverContent>
                </Popover>

                {/* Orange labeled action button (design v2 .searchgo). */}
                <motion.button
                    type='submit'
                    aria-label={search.title}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-it-md border-none bg-it-primary px-6 py-3 text-[16px] md:text-[19px] font-bold text-it-white transition-colors hover:bg-it-primary-hover'>
                    {search.title}
                </motion.button>
            </form>

            <AnimatePresence>
                {showPanel && (
                    <SearchTypeahead
                        // Tour rows come from the date-aware tour search; the
                        // entity rows from /search/suggest. `beyondTours` stays
                        // empty on purpose - this search is scoped to the island
                        // whose page you are on.
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
                        hubHref={(destSlug, slug) =>
                            localizeHref(locale, `/${destSlug}/${slug}`)
                        }
                        zeroState={zeroState}
                        onSelect={() => setFocused(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}

