'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
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
import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { SearchHit } from '@/types/search';

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
    dict: { searchPlaceholder: string; selectDate: string };
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

    const ref = useRef<HTMLDivElement>(null);
    const trimmed = query.trim();
    const showPanel = focused && trimmed.length >= 2;
    const isoDate = date ? format(date, 'yyyy-MM-dd') : undefined;

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
                { q, locale, destinationSlug, date: isoDate, limit: 6 },
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
    }, [query, locale, destinationSlug, isoDate]);

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
                {/* Search field - fills the left region */}
                <input
                    type='search'
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onFocus={() => setFocused(true)}
                    placeholder={dict.searchPlaceholder}
                    aria-label={dict.searchPlaceholder}
                    className='min-w-0 flex-1 bg-transparent border-none outline-none text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading placeholder:text-it-text-muted [&::-webkit-search-cancel-button]:appearance-none'
                />

                {/* Vertical divider - between search field and date (mobile + desktop) */}
                <span className='mx-4 h-8.5 w-px shrink-0 bg-it-heading md:mx-8' />

                {/* Date picker - "Select date" text on both mobile and desktop */}
                <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                        <button
                            type='button'
                            aria-label={dict.selectDate}
                            className={`flex shrink-0 cursor-pointer items-center whitespace-nowrap border-none bg-transparent p-0 text-left text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] ${date ? 'text-it-heading' : 'text-it-text-muted'}`}>
                            {date ? format(date, 'd MMM yyyy') : dict.selectDate}
                        </button>
                    </PopoverTrigger>
                    <PopoverContent
                        align='start'
                        sideOffset={28}
                        className='w-auto rounded-[8px] bg-it-white p-0 text-it-heading'>
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

                {/* Flexible gap - pushes the action button to the right (desktop) */}
                <div className='hidden flex-1 md:block' />

                {/* Orange action button */}
                <motion.button
                    type='submit'
                    aria-label={dict.searchPlaceholder}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                    className='grid size-10 shrink-0 cursor-pointer place-items-center rounded-it-full border-none bg-it-primary'>
                    <Image
                        src='/icons/hero-search-white.svg'
                        alt=''
                        width={18}
                        height={18}
                        className='size-4.5'
                    />
                </motion.button>
            </form>

            {showPanel && (
                <SearchTypeahead
                    hits={hits}
                    total={total}
                    loading={loading}
                    query={trimmed}
                    dict={search}
                    searchHref={searchHref}
                    tourHref={tourHref}
                    onSelect={() => setFocused(false)}
                />
            )}
        </div>
    );
}
