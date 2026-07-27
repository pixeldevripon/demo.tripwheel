'use client';

import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
// Reused presentational typeahead panel (shared with the navbar search). Candidate
// to promote to a shared `search/` folder once a third consumer appears.
import { SearchTypeahead } from '@/components/frontend/navbar/search-typeahead';
import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
import { searchToursClient } from '@/lib/api/search';
import {
    localizeHref,
    LOCALE_CURRENCY,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';
import { currencyFromCookie } from '@/lib/currency/current';
import { springPop } from '@/lib/motion';
import type { SearchHit, SearchSuggest } from '@/types/search';

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
}: {
    locale: Locale;
    destinationSlug: string;
    dict: { searchPlaceholder: string; selectDate: string; clearDate: string };
    search: SearchDict;
}) {
    const router = useRouter();
    const [query, setQuery] = useState('');
    const [hits, setHits] = useState<SearchHit[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [focused, setFocused] = useState(false);
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [dateOpen, setDateOpen] = useState(false);
    const [currency, setCurrency] = useState<Currency>(
        LOCALE_CURRENCY[locale] ?? 'EUR'
    );

    const ref = useRef<HTMLDivElement>(null);
    const trimmed = query.trim();
    const showPanel = focused && trimmed.length >= 2;
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
            setLoading(false);
            return;
        }
        setLoading(true);
        const controller = new AbortController();
        const timer = setTimeout(() => {
            searchToursClient(
                { q, locale, currency, destinationSlug, date: isoDate, limit: 6 },
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
    }, [query, locale, currency, destinationSlug, isoDate]);

    const searchHref = (q: string) => {
        const sp = new URLSearchParams({ q });
        sp.set('destination', destinationSlug);
        if (isoDate) sp.set('date', isoDate);
        return `${localizeHref(locale, '/search')}?${sp.toString()}`;
    };

    const tourHref = (hit: SearchHit) =>
        hit.destinationSlug
            ? localizeHref(locale, `/${hit.destinationSlug}/${hit.slug}`)
            : localizeHref(locale, `/search?q=${encodeURIComponent(hit.title)}`);

    function submit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const q = trimmed;
        if (!q) return;
        setFocused(false);
        router.push(searchHref(q));
    }

    return (
        <div ref={ref} className='relative w-full'>
            <form
                onSubmit={submit}
                role='search'
                className='flex h-15 w-full items-center gap-2 rounded-it-full border border-it-search-border bg-it-white pl-5 pr-2 md:h-20 md:gap-0 md:pl-9 md:pr-5'>
                {/* Search field - fills the left region. h-full + the divider
                    gap as padding, so the WHOLE left half of the pill focuses
                    the input, not just the text line. */}
                <input
                    type='search'
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    placeholder={dict.searchPlaceholder}
                    aria-label={dict.searchPlaceholder}
                    className='min-w-0 h-full flex-1 pr-4 md:pr-8 bg-transparent border-none outline-none text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading placeholder:text-it-text-muted [&::-webkit-search-cancel-button]:appearance-none'
                />

                {/* Vertical divider - between search field and date (mobile + desktop).
                    No margins: the gaps live as padding on the clickable
                    neighbours so there is no dead zone around the divider. */}
                <span className='h-8.5 w-px shrink-0 bg-it-heading' />

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
                    <div className='flex h-full shrink-0 md:flex-1 items-center gap-1.5'>
                        <PopoverTrigger asChild>
                            <motion.button
                                type='button'
                                aria-label={dict.selectDate}
                                transition={springPop}
                                className={`flex h-full cursor-pointer items-center whitespace-nowrap border-none bg-transparent p-0 pl-4 md:pl-8 text-left text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors duration-300 ${date ? 'text-it-heading' : 'md:flex-1 text-it-text-muted'}`}>
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
                            onSelect={(selected) => {
                                setDate(selected);
                                setDateOpen(false);
                            }}
                            disabled={{ before: new Date() }}
                            autoFocus
                            className='bg-it-white [--cell-radius:8px]'
                        />
                    </PopoverContent>
                </Popover>

                {/* Orange action button (the old flexible spacer is now part of
                    the date trigger's clickable area) */}
                <motion.button
                    type='submit'
                    aria-label={dict.searchPlaceholder}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='grid size-10 shrink-0 cursor-pointer place-items-center rounded-it-full border-none bg-it-primary transition-colors hover:bg-it-primary-hover'>
                    <Image
                        src='/icons/hero-search-white.svg'
                        alt=''
                        width={18}
                        height={18}
                        className='size-4.5'
                    />
                </motion.button>
            </form>

            <AnimatePresence>
                {showPanel && (
                    <SearchTypeahead
                        // Hero search stays tours-only (it carries the date
                        // filter, which /search/suggest doesn't) - wrapped in
                        // the suggest shape with empty entity buckets.
                        suggest={
                            {
                                query: trimmed,
                                total,
                                categories: [],
                                hubs: [],
                                tours: hits,
                                beyondTours: [],
                            } satisfies SearchSuggest
                        }
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
                        onSelect={() => setFocused(false)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
