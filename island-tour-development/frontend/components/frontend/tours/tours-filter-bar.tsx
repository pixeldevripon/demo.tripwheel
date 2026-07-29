'use client';

import { useToursNav } from '@/components/frontend/tours/tours-browser';
import type { Currency, Locale } from '@/lib/constants/locales';
import {
    countActiveFilters,
    EMPTY_FILTERS,
    ToursFilterModal,
    type TourFilters,
    type ToursFilterModalDict,
} from '@/components/frontend/tours/tours-filter-modal';
import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { useDragScroll } from '@/hooks/use-drag-scroll';
import { springPop } from '@/lib/motion';
import {
    buildToursHref,
    DEFAULT_GUESTS,
    PRICE_MAX,
    PRICE_MIN,
    type ToursFilterState,
    type ToursGuests,
    type ToursSortValue,
} from '@/lib/tours/filters';
import { format, parse } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { Minus, Plus } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useOptimistic, useState } from 'react';

/* ── Dictionary shapes ─────────────────────────────────────────────── */

export type ToursToolbarDict = {
    /** Label on the filters control pill - e.g. "Filters" */
    filters: string;
    /** Date pill placeholder when no date is picked - e.g. "Select date" */
    selectDate: string;
    /** Accessible label for the date pill's clear control - e.g. "Clear date" */
    clearDate: string;
    /**
     * Guest types: `label` + `hint` shown in the stepper rows, `word` used in the
     * chip summary (e.g. "2 adults & 3 children").
     */
    guestTypes: {
        adults: { label: string; hint: string; word: string };
        children: { label: string; hint: string; word: string };
        infants: { label: string; hint: string; word: string };
    };
    /** Result counter template - e.g. "{shown} of {total}" */
    resultsCount: string;
    /** Trailing word after the counter - e.g. "tours" */
    toursWord: string;
    /** Clear-all-filters action label */
    clearAll: string;
    /** "Sort by:" prefix label */
    sortBy: string;
};

export type SortValue = ToursSortValue;

export type ToursSortDict = {
    localsFavorites: string;
    priceLowHigh: string;
    priceHighLow: string;
    /** Suffix appended to the default option inside the dropdown - e.g. "(Default)". */
    defaultSuffix: string;
};

export type FilterCategory = { label: string; slug: string };

interface ToursFilterBarProps {
    dict: ToursToolbarDict;
    sortDict: ToursSortDict;
    /** Labels for the Filters modal opened by the Filters pill. */
    filterDict: ToursFilterModalDict;
    /** Reveal the Ratings section in the Filters modal (once tours have reviews). */
    hasReviews?: boolean;
    /** Quick-filter category pills (horizontally scrollable). */
    categories: FilterCategory[];
    /**
     * Hide category selection entirely (the category page, where the category is
     * fixed by the route): no category pills row, no category chips.
     */
    lockCategory?: boolean;
    /** Result counter - shown vs total. */
    shown: number;
    total: number;
    /**
     * Current filter/sort state, derived server-side from the URL. The bar is
     * controlled by these props and navigates (`?...`) on change; the server then
     * refetches. Time-of-day flows through `activeFilters.times` (the modal).
     */
    selectedCategories: string[];
    /** Availability anchor date (YYYY-MM-DD), or undefined. */
    selectedDate?: string;
    /** Guest breakdown (URL-derived); commits on the popover closing. */
    guests: ToursGuests;
    sort: SortValue;
    activeFilters: TourFilters;
    /** Effective price ceiling (per destination/category); slider + URL max. */
    priceMax?: number;
    /** Display currency + locale for the filter modal's price-bound labels. */
    currency: Currency;
    locale: Locale;
    /**
     * Active dynamic attribute filters (from the URL). No modal UI sets these, but
     * the toolbar preserves them across navigations so URL/deep-link attribute
     * filters survive sort/category/price changes.
     */
    attributes?: Record<string, string[]>;
}

/* ── Shared atom styles ────────────────────────────────────────────── */

// Text colour intentionally NOT in the base - the category pills swap it for
// primary in their active state, which would otherwise fight the base class.
const PILL_BASE =
    'flex h-9.5 md:h-12.5 shrink-0 items-center gap-2 rounded-it-full px-3 md:px-6 py-2 md:py-3 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors';

/**
 * Tours filter & sort toolbar - matches Figma node 47167:4032.
 *
 * Row 1: pinned date / guests / filters control pills + a divider, then the
 * category quick-filters as bordered rounded chips (neutral surface when
 * active) in one horizontally scrolling row. Row 2: result counter +
 * applied-filter chips (primary) + "Clear all" on the left, sort dropdown
 * pinned to the row's top-right.
 */
export function ToursFilterBar({
    dict,
    sortDict,
    filterDict,
    hasReviews = false,
    categories,
    lockCategory = false,
    shown,
    total,
    selectedCategories,
    selectedDate,
    guests,
    sort,
    activeFilters,
    priceMax = PRICE_MAX,
    currency,
    locale,
    attributes = {},
}: ToursFilterBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { startNav } = useToursNav();

    // Grab-to-slide the horizontally-overflowing strips with a plain mouse
    // (same affordance as the tab bars); no-ops on touch and when the content
    // fits. Desktop: only the category strip scrolls (control pills pinned).
    // Mobile: the whole row 1 scrolls as one strip (pills + categories).
    const row1Ref = useDragScroll<HTMLDivElement>();
    const categoriesRowRef = useDragScroll<HTMLDivElement>();
    const metaRowRef = useDragScroll<HTMLDivElement>();

    // Categories render optimistically: a chip toggle flips its own state on
    // click (inside the nav transition) and only settles back to the server truth
    // once the filtered page has streamed - so the click never feels stuck while
    // the round-trip is in flight.
    const [optimisticCategories, setOptimisticCategories] =
        useOptimistic(selectedCategories);

    // The bar is controlled by the URL-derived props; a change rebuilds the query
    // and navigates (always resetting to page 1), and the server refetches.
    const currentState: ToursFilterState = {
        categories: selectedCategories,
        sort,
        price: activeFilters.price,
        rating: activeFilters.rating,
        durations: activeFilters.durations,
        cancellation: activeFilters.cancellation,
        pickup: activeFilters.pickupAvailable,
        date: selectedDate ?? null,
        guests,
        timeOfDay: activeFilters.times,
        attributes,
        page: 1,
    };
    // Navigate inside a transition (non-blocking); `replace` + `scroll: false`
    // keeps filter changes out of history and avoids a jump to the top. When the
    // change touches categories, flip the optimistic set in the same transition.
    const applyState = (next: Partial<ToursFilterState>) => {
        const href = buildToursHref(
            pathname,
            { ...currentState, ...next, page: 1 },
            priceMax
        );
        startNav(() => {
            if (next.categories) setOptimisticCategories(next.categories);
            router.replace(href, { scroll: false });
        });
    };
    // Prefetch the target page on hover/focus so the result is often already
    // warm (RSC payload + cached `getDestinationTours`) by the time it's clicked.
    const prefetchState = (next: Partial<ToursFilterState>) =>
        router.prefetch(
            buildToursHref(
                pathname,
                { ...currentState, ...next, page: 1 },
                priceMax
            )
        );

    // Selected categories rendered as removable chips in row 2 (multi-select).
    const chips = categories.filter(c => optimisticCategories.includes(c.slug));

    // Date - URL-backed. Parse the anchor to a Date for the calendar; selecting a
    // day navigates immediately (single action).
    const date = selectedDate
        ? parse(selectedDate, 'yyyy-MM-dd', new Date())
        : undefined;
    const [dateOpen, setDateOpen] = useState(false);

    // Guests - URL-backed, but edited as a local draft so a burst of +/- clicks
    // is committed as ONE navigation when the popover closes (not per click).
    const [guestsOpen, setGuestsOpen] = useState(false);
    const [guestDraft, setGuestDraft] = useState<ToursGuests>(guests);

    type GuestType = keyof ToursGuests;
    const stepGuest = (type: GuestType, delta: number) =>
        setGuestDraft(g => ({
            ...g,
            [type]: Math.min(
                20,
                Math.max(type === 'adults' ? 1 : 0, g[type] + delta)
            ),
        }));

    // Open: seed the draft from the URL value. Close: commit if it changed.
    const onGuestsOpenChange = (open: boolean) => {
        setGuestsOpen(open);
        if (open) {
            setGuestDraft(guests);
        } else if (
            guestDraft.adults !== guests.adults ||
            guestDraft.children !== guests.children ||
            guestDraft.infants !== guests.infants
        ) {
            applyState({ guests: guestDraft });
        }
    };

    // Chip summary - only non-zero types, e.g. "2 adults & 3 children".
    const guestParts = (['adults', 'children', 'infants'] as const)
        .filter(type => guests[type] > 0)
        .map(type => `${guests[type]} ${dict.guestTypes[type].word}`);
    const guestsLabel =
        guestParts.length <= 1
            ? guestParts[0]
            : `${guestParts.slice(0, -1).join(', ')} & ${guestParts.at(-1)}`;

    // Filters modal state - the Filters pill opens it; the URL-derived filters
    // drive the badge.
    const [filterOpen, setFilterOpen] = useState(false);
    const activeFilterCount = countActiveFilters(activeFilters, priceMax);

    // Default option carries the "(Default)" suffix only inside the dropdown.
    const sortOptions: { value: SortValue; label: string }[] = [
        {
            value: 'localsFavorites',
            label: `${sortDict.localsFavorites} ${sortDict.defaultSuffix}`,
        },
        { value: 'priceLowHigh', label: sortDict.priceLowHigh },
        { value: 'priceHighLow', label: sortDict.priceHighLow },
    ];
    const [sortOpen, setSortOpen] = useState(false);

    // Multi-select: toggling an active category removes it, otherwise adds it.
    // Built from the optimistic set so a burst of rapid clicks accumulates
    // correctly before any server round-trip settles.
    function toggleCategory(cat: FilterCategory) {
        const next = optimisticCategories.includes(cat.slug)
            ? optimisticCategories.filter(s => s !== cat.slug)
            : [...optimisticCategories, cat.slug];
        applyState({ categories: next });
    }

    function removeChip(slug: string) {
        applyState({
            categories: optimisticCategories.filter(s => s !== slug),
        });
    }

    // Clear all applied filters (categories + modal filters + availability); sort
    // is preserved.
    function clearAll() {
        applyState({
            categories: [],
            price: [PRICE_MIN, priceMax],
            rating: EMPTY_FILTERS.rating,
            durations: EMPTY_FILTERS.durations,
            timeOfDay: EMPTY_FILTERS.times,
            cancellation: EMPTY_FILTERS.cancellation,
            pickup: EMPTY_FILTERS.pickupAvailable,
            attributes: {},
            date: null,
            guests: DEFAULT_GUESTS,
        });
    }

    const counterLabel = dict.resultsCount
        .replace('{shown}', String(shown))
        .replace('{total}', String(total));

    return (
        <div className='flex flex-col gap-6'>
            {/* ── Row 1 - control pills · category quick-filters. Desktop:
                pills pinned, only the category strip scrolls. Mobile: the
                whole row scrolls as one strip. ── */}
            <div
                ref={row1Ref}
                className='flex items-center gap-4 max-md:overflow-x-auto max-md:pb-1 [scrollbar-width:none] md:overflow-visible [&::-webkit-scrollbar]:hidden'>
                {/* Left group - control pills + vertical divider (pinned) */}
                <div className='flex shrink-0 items-center gap-4'>
                    <div className='flex items-center gap-2'>
                        {/* Date - calendar popover (desktop; the mobile pill
                            lives in the header per Figma). The clear control
                            is a SIBLING of the trigger (a button's descendants
                            are presentational to the accessibility tree, so a
                            nested control would be unreachable). */}
                        <Popover open={dateOpen} onOpenChange={setDateOpen}>
                            <div
                                className={`flex h-9.5 md:h-12.5 shrink-0 items-center rounded-it-full text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors max-md:hidden border text-it-heading ${
                                    date
                                        ? 'border-it-heading-subtle bg-it-surface'
                                        : 'border-it-heading/10 bg-it-white hover:bg-it-surface'
                                }`}>
                                <PopoverTrigger asChild>
                                    <motion.button
                                        type='button'
                                        transition={springPop}
                                        className={`flex h-full cursor-pointer items-center gap-2 whitespace-nowrap border-none bg-transparent py-2 pl-3 md:py-3 md:pl-6 text-inherit ${date ? 'pr-1.5' : 'pr-3 md:pr-6'}`}>
                                        <Image
                                            src='/icons/filters/calendar.svg'
                                            alt=''
                                            width={24}
                                            height={24}
                                            className='size-6 shrink-0'
                                        />
                                        {date
                                            ? format(date, 'd MMM')
                                            : dict.selectDate}
                                    </motion.button>
                                </PopoverTrigger>
                                {date && (
                                    <motion.button
                                        type='button'
                                        aria-label={dict.clearDate}
                                        whileTap={{ scale: 0.9 }}
                                        transition={springPop}
                                        onClick={() =>
                                            applyState({ date: null })
                                        }
                                        className='grid h-full shrink-0 cursor-pointer place-items-center border-none bg-transparent pl-0.5 pr-2 md:pr-4'>
                                        <Image
                                            src='/icons/filters/close-circle.svg'
                                            alt=''
                                            width={24}
                                            height={24}
                                            className='size-5 shrink-0 md:size-6'
                                        />
                                    </motion.button>
                                )}
                            </div>
                            <PopoverContent
                                align='start'
                                sideOffset={12}
                                className='w-auto rounded-[10px] border-none bg-it-white p-0 text-it-heading shadow-[5px_10px_24px_-4px_rgba(0,0,0,0.16)] duration-300 ease-[cubic-bezier(0.21,0.47,0.32,0.98)]'>
                                <Calendar
                                    mode='single'
                                    selected={date}
                                    onSelect={selected => {
                                        applyState({
                                            date: selected
                                                ? format(selected, 'yyyy-MM-dd')
                                                : null,
                                        });
                                        setDateOpen(false);
                                    }}
                                    disabled={{ before: new Date() }}
                                    autoFocus
                                    className='bg-it-white [--cell-radius:8px]'
                                />
                            </PopoverContent>
                        </Popover>

                        {/* Guests - stepper popover */}
                        <Popover
                            open={guestsOpen}
                            onOpenChange={onGuestsOpenChange}>
                            <PopoverTrigger asChild>
                                <motion.button
                                    type='button'
                                    transition={springPop}
                                    className={`${PILL_BASE} border border-it-heading-subtle bg-it-surface text-it-heading`}>
                                    <Image
                                        src='/icons/filters/profile.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-5 md:size-6 shrink-0'
                                    />
                                    {guestsLabel}
                                </motion.button>
                            </PopoverTrigger>
                            <PopoverContent
                                align='start'
                                sideOffset={12}
                                className='w-72 rounded-[10px] border-none bg-it-white p-4 text-it-heading shadow-[5px_10px_24px_-4px_rgba(0,0,0,0.16)] duration-300 ease-[cubic-bezier(0.21,0.47,0.32,0.98)]'>
                                <div className='flex flex-col gap-4'>
                                    {(
                                        [
                                            'adults',
                                            'children',
                                            'infants',
                                        ] as const
                                    ).map(type => {
                                        const t = dict.guestTypes[type];
                                        const min = type === 'adults' ? 1 : 0;
                                        return (
                                            <div
                                                key={type}
                                                className='flex items-center justify-between'>
                                                <div className='flex flex-col'>
                                                    <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                        {t.label}
                                                    </span>
                                                    <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                        {t.hint}
                                                    </span>
                                                </div>
                                                <div className='flex items-center gap-3'>
                                                    <motion.button
                                                        type='button'
                                                        aria-label={`Decrease ${type}`}
                                                        disabled={
                                                            guestDraft[type] <=
                                                            min
                                                        }
                                                        onClick={() =>
                                                            stepGuest(type, -1)
                                                        }
                                                        whileTap={
                                                            guestDraft[type] >
                                                            min
                                                                ? { scale: 0.9 }
                                                                : undefined
                                                        }
                                                        transition={springPop}
                                                        className='grid size-8 place-items-center rounded-full border border-it-heading/20 bg-it-white text-it-heading transition-colors hover:bg-it-surface disabled:cursor-not-allowed disabled:opacity-30'>
                                                        <Minus
                                                            className='size-4'
                                                            strokeWidth={1.5}
                                                        />
                                                    </motion.button>
                                                    <span className='min-w-5 text-center text-[16px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                        {guestDraft[type]}
                                                    </span>
                                                    <motion.button
                                                        type='button'
                                                        aria-label={`Increase ${type}`}
                                                        disabled={
                                                            guestDraft[type] >=
                                                            20
                                                        }
                                                        onClick={() =>
                                                            stepGuest(type, 1)
                                                        }
                                                        whileTap={
                                                            guestDraft[type] <
                                                            20
                                                                ? { scale: 0.9 }
                                                                : undefined
                                                        }
                                                        transition={springPop}
                                                        className='grid size-8 place-items-center rounded-full border border-it-heading/20 bg-it-white text-it-heading transition-colors hover:bg-it-surface disabled:cursor-not-allowed disabled:opacity-30'>
                                                        <Plus
                                                            className='size-4'
                                                            strokeWidth={1.5}
                                                        />
                                                    </motion.button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Filters - opens the Filters modal */}
                        <motion.button
                            type='button'
                            onClick={() => setFilterOpen(true)}
                            transition={springPop}
                            className={`${PILL_BASE} border text-it-heading ${
                                activeFilterCount > 0
                                    ? 'border-it-heading bg-it-surface'
                                    : 'border-it-heading/10 bg-it-white hover:bg-it-surface'
                            }`}>
                            <Image
                                src='/icons/filters/filters.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-5 md:size-6 shrink-0'
                            />
                            {dict.filters}
                            {activeFilterCount > 0 && (
                                <span className='inline-flex h-5.5 min-w-5.5 md:h-6.5 md:min-w-6.5 items-center justify-center rounded-it-full bg-it-heading px-2 text-[14px] md:text-[16px] leading-[1.6] text-it-white'>
                                    {activeFilterCount}
                                </span>
                            )}
                        </motion.button>

                        <ToursFilterModal
                            open={filterOpen}
                            onClose={() => setFilterOpen(false)}
                            dict={filterDict}
                            hasReviews={hasReviews}
                            priceMax={priceMax}
                            currency={currency}
                            locale={locale}
                            value={activeFilters}
                            onApply={f => {
                                applyState({
                                    price: f.price,
                                    rating: f.rating,
                                    durations: f.durations,
                                    timeOfDay: f.times,
                                    cancellation: f.cancellation,
                                    pickup: f.pickupAvailable,
                                });
                                setFilterOpen(false);
                            }}
                        />
                    </div>

                    {!lockCategory && (
                        <span
                            className='h-8.5 w-px shrink-0 bg-it-heading/20'
                            aria-hidden='true'
                        />
                    )}
                </div>

                {/* Category quick-filter pills - one horizontally scrolling
                    row (every category reachable however many exist). On
                    mobile the strip itself doesn't scroll - it extends at
                    full width and rides the row-1 scroll instead. Hidden on
                    the category page (route fixes the category). */}
                {!lockCategory && (
                    <div
                        ref={categoriesRowRef}
                        className='flex items-center gap-2 py-1 max-md:w-max md:min-w-0 md:flex-1 md:overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                        {categories.map(cat => {
                            const active = optimisticCategories.includes(
                                cat.slug
                            );
                            // Prefetch the toggled-on result (the common intent).
                            const prefetch = () =>
                                !active &&
                                prefetchState({
                                    categories: [
                                        ...optimisticCategories,
                                        cat.slug,
                                    ],
                                });
                            return (
                                <motion.button
                                    key={cat.slug}
                                    type='button'
                                    aria-pressed={active}
                                    onClick={() => toggleCategory(cat)}
                                    onPointerEnter={prefetch}
                                    onFocus={prefetch}
                                    whileTap={{ scale: 0.99 }}
                                    transition={springPop}
                                    className={`flex h-9.5 md:h-10.5 shrink-0 items-center whitespace-nowrap rounded-it-full border px-3 md:px-4 text-[14px] md:text-[16px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors ${
                                        active
                                            ? 'border-it-heading-subtle bg-it-surface'
                                            : 'border-it-heading/10 bg-it-white hover:bg-it-surface'
                                    }`}>
                                    {cat.label}
                                </motion.button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Row 2 - counter + chips + clear all · sort ──────────────────
                Mobile: counter/chips/clear-all scroll horizontally (clear-all
                sits off-screen, reachable by scroll) with the sort on its own
                line below. Desktop: one row - only the LEFT column wraps, the
                row itself never does, so the sort dropdown stays pinned to
                the top-right no matter how many chips there are. */}
            <div className='flex flex-col gap-3 md:flex-row md:items-start md:gap-x-8'>
                {/* Counter, applied chips, clear all */}
                <div
                    ref={metaRowRef}
                    className='flex min-w-0 flex-1 items-center gap-3 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-auto md:flex-wrap md:overflow-visible md:gap-x-8 md:gap-y-3 md:pb-0 [&::-webkit-scrollbar]:hidden'>
                    {/* Counter + chip block share one line on desktop: the
                        counter is pinned, the chip block shrinks and wraps
                        internally beside it. */}
                    <div className='flex shrink-0 items-center gap-2 md:min-w-0 md:shrink md:gap-x-4'>
                        <p className='m-0 shrink-0 whitespace-nowrap text-[14px] leading-[1.6] tracking-[-0.012em] md:text-[16px]'>
                            <span className='font-medium text-it-heading'>
                                {counterLabel}
                            </span>{' '}
                            <span className='text-it-text-muted'>
                                {dict.toursWord}
                            </span>
                        </p>

                        <AnimatePresence initial={false}>
                            {chips.length > 0 && (
                                <motion.div
                                    key='chips'
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.002 }}
                                    className='flex shrink-0 items-center gap-2 md:min-w-0 md:shrink md:flex-wrap md:gap-y-2'>
                                    <AnimatePresence initial={false}>
                                        {chips.map(chip => (
                                            <motion.button
                                                key={chip.slug}
                                                type='button'
                                                onClick={() =>
                                                    removeChip(chip.slug)
                                                }
                                                layout
                                                initial={{
                                                    opacity: 0,
                                                    scale: 0.9,
                                                }}
                                                animate={{
                                                    opacity: 1,
                                                    scale: 1,
                                                }}
                                                exit={{
                                                    opacity: 0,
                                                    scale: 0.9,
                                                    transition: {
                                                        duration: 0.1,
                                                    },
                                                }}
                                                whileTap={{ scale: 0.95 }}
                                                className='inline-flex shrink-0 items-center gap-0.75 whitespace-nowrap rounded-it-full bg-it-primary-subtle py-1 pl-3 pr-2.5 text-[14px] md:py-1.25 md:pl-5 md:pr-3.5 md:text-[16px] leading-[1.6] tracking-[-0.012em] font-medium text-it-primary transition-colors hover:text-it-primary-hover'>
                                                {chip.label}
                                                <Image
                                                    src='/icons/filters/close-circle-primary.svg'
                                                    alt=''
                                                    width={24}
                                                    height={24}
                                                    className='size-6 shrink-0'
                                                />
                                            </motion.button>
                                        ))}
                                    </AnimatePresence>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    <AnimatePresence initial={false}>
                        {(chips.length > 0 || activeFilterCount > 0) && (
                            <motion.button
                                key='clear-all'
                                type='button'
                                onClick={clearAll}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                whileTap={{ scale: 0.97 }}
                                transition={springPop}
                                className='shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[14px] font-medium leading-[1.6] tracking-[-0.012em] text-it-primary underline underline-offset-2 transition-colors hover:text-it-primary-hover md:text-[16px]'>
                                {dict.clearAll}
                            </motion.button>
                        )}
                    </AnimatePresence>
                </div>

                {/* Right - sort dropdown pinned to the row's end (on desktop
                    nudged to align with the first chip line) */}
                <div className='flex shrink-0 items-center gap-2 md:gap-3.5 md:pt-1.25'>
                    <span className='whitespace-nowrap text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted md:text-[16px]'>
                        {dict.sortBy}
                    </span>
                    <Popover open={sortOpen} onOpenChange={setSortOpen}>
                        <PopoverTrigger asChild>
                            <motion.button
                                type='button'
                                className='flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-none bg-transparent p-0 text-[14px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading md:gap-2 md:text-[16px]'>
                                {sortDict[sort]}
                                <Image
                                    src='/icons/filters/chevron-down.svg'
                                    alt=''
                                    width={20}
                                    height={20}
                                    className={`size-4 shrink-0 transition-transform duration-300 md:size-5 ${sortOpen ? 'rotate-180' : ''}`}
                                />
                            </motion.button>
                        </PopoverTrigger>
                        <PopoverContent
                            align='end'
                            sideOffset={12}
                            className='w-51 overflow-hidden rounded-[10px] border-none bg-it-white p-0 text-it-heading shadow-[5px_10px_24px_-4px_rgba(0,0,0,0.16)] duration-300 ease-[cubic-bezier(0.21,0.47,0.32,0.98)] md:w-57.25'>
                            {sortOptions.map((opt, i) => (
                                <motion.button
                                    key={opt.value}
                                    type='button'
                                    onClick={() => {
                                        applyState({ sort: opt.value });
                                        setSortOpen(false);
                                    }}
                                    initial={{ opacity: 0, y: -6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    whileTap={{ scale: 0.98 }}
                                    transition={{
                                        ...springPop,
                                        delay: i * 0.03,
                                    }}
                                    className={`flex w-full cursor-pointer items-center border-none bg-transparent px-4 py-2 text-left text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors hover:bg-it-surface md:text-[16px] ${
                                        opt.value === sort ? 'font-medium' : ''
                                    }`}>
                                    {opt.label}
                                </motion.button>
                            ))}
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
}

