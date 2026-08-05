'use client';

import { useToursNav } from '@/components/frontend/tours/tours-browser';
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
import type { Currency, Locale } from '@/lib/constants/locales';
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
import { cn } from '@/lib/utils';
import { format, parse } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useOptimistic, useState } from 'react';

/* ── Dictionary shapes ─────────────────────────────────────────────── */

export type ToursToolbarDict = {
    /** Label on the filters control pill - e.g. "Filters" */
    filters: string;
    /** Date pill placeholder when no date is picked - e.g. "Date" */
    selectDate: string;
    /** Accessible label for the date pill's clear control - e.g. "Clear date" */
    clearDate: string;
    /**
     * Guest types: `label` + `hint` shown in the stepper rows, `word` used in the
     * chip summary (e.g. "2 Adults & 3 Children").
     */
    guestTypes: {
        adults: { label: string; hint: string; word: string };
        children: { label: string; hint: string; word: string };
        infants: { label: string; hint: string; word: string };
    };
    /** Apply action in the travelers popover - e.g. "Apply" */
    applyGuests: string;
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

/* ── Shared atom styles (design v2) ────────────────────────────────── */

// Control chip (.fchip): bordered white pill, 13.5px bold; the active state
// swaps to the warm cta tint with the deep-orange text.
const CHIP_INACTIVE = 'border-it-border bg-it-white text-it-ink';
const CHIP_ACTIVE =
    'border-it-primary bg-it-primary-subtle text-it-primary-hover';
const CHIP_BASE =
    'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-it-full border text-[13.5px] font-bold leading-[1.6] transition-colors duration-(--it-duration-xs) ease-(--it-ease)';

/**
 * Tours filter & sort toolbar - design v2 `.frow` + `.gridhead`.
 *
 * The filter row is a full-width band, sticky under the navbar (backdrop blur +
 * hairline): Date / Travelers / Filters control chips, a vertical divider, the
 * category quick-filter chips, and the sort control pinned right on desktop.
 * On mobile the whole row scrolls horizontally as one strip.
 *
 * The grid head below it (inside the container) carries the result counter,
 * the applied category chips (removable pills) and "Clear all".
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
    // fits. Mobile: row 1 and the grid head each scroll as one strip.
    const row1Ref = useDragScroll<HTMLDivElement>();
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
        // `optimisticCategories`, NOT the server prop. Every other consumer in
        // this file already reads the optimistic set (the chips, `toggleCategory`,
        // `removeChip`); this one did not. So while a category toggle's
        // round-trip was in flight, a second interaction that does not touch
        // categories - a sort change, a date pick, applying the modal - rebuilt
        // the href from the PRE-TOGGLE list and silently dropped the pending
        // selection, chip and all. Reachable in two interactions on a slow
        // connection, and exactly what the optimistic set exists to prevent.
        categories: optimisticCategories,
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

    // Selected categories rendered as removable chips in the grid head.
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

    // Chip summary - only non-zero types, e.g. "2 Adults & 3 Children".
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

    const sortOptions: { value: SortValue; label: string }[] = [
        { value: 'localsFavorites', label: sortDict.localsFavorites },
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
        <>
            {/* ── Filter row (.frow) - sticky under the navbar, full-width
                band with backdrop blur + hairline. Mobile: one horizontally
                scrolling strip. ── */}
            <div className='sticky top-16 z-35 mt-3.5 border-b border-it-divider bg-(--it-frow-bg) py-3 backdrop-blur-[8px]'>
                <div
                    ref={row1Ref}
                    className='it-container flex items-center gap-2.5 max-md:flex-nowrap max-md:overflow-x-auto max-md:pb-0.5 [scrollbar-width:none] md:overflow-visible [&::-webkit-scrollbar]:hidden'>
                    {/* Date - calendar popover. The clear control is a SIBLING
                        of the trigger (a button's descendants are
                        presentational to the accessibility tree, so a nested
                        control would be unreachable). */}
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                        <div
                            className={cn(
                                CHIP_BASE,
                                date ? CHIP_ACTIVE : CHIP_INACTIVE
                            )}>
                            <PopoverTrigger asChild>
                                <motion.button
                                    type='button'
                                    transition={springPop}
                                    className={`flex h-full cursor-pointer items-center gap-2 whitespace-nowrap border-none bg-transparent py-[9px] pl-[15px] text-inherit ${date ? 'pr-1' : 'pr-[15px]'}`}>
                                    <Image
                                        src='/icons/calendar-soft.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-[15px] shrink-0'
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
                                    onClick={() => applyState({ date: null })}
                                    className='grid h-full shrink-0 cursor-pointer place-items-center border-none bg-transparent pl-0.5 pr-2.5'>
                                    <Image
                                        src='/icons/filters/close-deep.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-3 shrink-0'
                                    />
                                </motion.button>
                            )}
                        </div>
                        <PopoverContent
                            align='start'
                            sideOffset={10}
                            className='w-auto rounded-it-lg border-none bg-it-white p-0 text-it-ink shadow-it-lg duration-300 ease-(--it-ease)'>
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

                    {/* Travelers - stepper popover (locked Adults Selector) */}
                    <Popover
                        open={guestsOpen}
                        onOpenChange={onGuestsOpenChange}>
                        <PopoverTrigger asChild>
                            <motion.button
                                type='button'
                                transition={springPop}
                                className={cn(
                                    CHIP_BASE,
                                    'cursor-pointer px-[15px] py-[9px]',
                                    CHIP_INACTIVE
                                )}>
                                <Image
                                    src='/icons/filters/person-soft.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-[15px] shrink-0'
                                />
                                {guestsLabel}
                            </motion.button>
                        </PopoverTrigger>
                        <PopoverContent
                            align='start'
                            sideOffset={10}
                            className='w-[300px] rounded-it-lg border-none bg-it-white p-4 text-it-ink shadow-it-lg duration-300 ease-(--it-ease)'>
                            <div className='flex flex-col'>
                                {(
                                    ['adults', 'children', 'infants'] as const
                                ).map((type, i, arr) => {
                                    const t = dict.guestTypes[type];
                                    const min = type === 'adults' ? 1 : 0;
                                    return (
                                        <div
                                            key={type}
                                            className={`flex items-center justify-between py-[9px] ${i < arr.length - 1 ? 'border-b border-it-divider' : ''}`}>
                                            <div>
                                                <b className='block text-[14px] font-bold leading-[1.6] text-it-ink'>
                                                    {t.label}
                                                </b>
                                                <span className='text-[12px] leading-[1.6] text-it-text-muted'>
                                                    {t.hint}
                                                </span>
                                            </div>
                                            <div className='flex items-center gap-3'>
                                                <motion.button
                                                    type='button'
                                                    aria-label={`Decrease ${type}`}
                                                    disabled={
                                                        guestDraft[type] <= min
                                                    }
                                                    onClick={() =>
                                                        stepGuest(type, -1)
                                                    }
                                                    whileTap={
                                                        guestDraft[type] > min
                                                            ? { scale: 0.9 }
                                                            : undefined
                                                    }
                                                    transition={springPop}
                                                    className='grid size-[30px] cursor-pointer place-items-center rounded-full border border-it-border bg-it-white text-[16px] font-bold text-it-ink disabled:cursor-default disabled:opacity-30'>
                                                    −
                                                </motion.button>
                                                <i className='min-w-[18px] text-center text-[15px] not-italic font-bold text-it-ink tabular-nums'>
                                                    {guestDraft[type]}
                                                </i>
                                                <motion.button
                                                    type='button'
                                                    aria-label={`Increase ${type}`}
                                                    disabled={
                                                        guestDraft[type] >= 20
                                                    }
                                                    onClick={() =>
                                                        stepGuest(type, 1)
                                                    }
                                                    whileTap={
                                                        guestDraft[type] < 20
                                                            ? { scale: 0.9 }
                                                            : undefined
                                                    }
                                                    transition={springPop}
                                                    className='grid size-[30px] cursor-pointer place-items-center rounded-full border border-it-border bg-it-white text-[16px] font-bold text-it-ink disabled:cursor-default disabled:opacity-30'>
                                                    +
                                                </motion.button>
                                            </div>
                                        </div>
                                    );
                                })}
                                <motion.button
                                    type='button'
                                    onClick={() => onGuestsOpenChange(false)}
                                    whileTap={{ scale: 0.98 }}
                                    transition={springPop}
                                    className='mt-3 w-full cursor-pointer rounded-it-sm border-none bg-it-dark py-[11px] text-[14px] font-bold text-it-white'>
                                    {dict.applyGuests}
                                </motion.button>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Filters - opens the Filters modal */}
                    <motion.button
                        type='button'
                        onClick={() => setFilterOpen(true)}
                        transition={springPop}
                        className={cn(
                            CHIP_BASE,
                            'cursor-pointer px-[15px] py-[9px]',
                            activeFilterCount > 0 ? CHIP_ACTIVE : CHIP_INACTIVE
                        )}>
                        <Image
                            src='/icons/filters/filter-lines-soft.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-[15px] shrink-0'
                        />
                        {dict.filters}
                        {activeFilterCount > 0 && (
                            <span className='inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-it-full bg-it-primary px-1 text-[10.5px] font-bold leading-none text-it-white tabular-nums'>
                                {activeFilterCount}
                            </span>
                        )}
                    </motion.button>

                    {!lockCategory && categories.length > 0 && (
                        <>
                            {/* Vertical divider between controls and chips */}
                            <span
                                className='mx-1 w-px shrink-0 self-stretch bg-it-border'
                                aria-hidden='true'
                            />

                            {/* Category quick-filter chips: navigation-styled
                                pills (borderless, paper hover, tint when
                                active). Wrap on desktop, ride the row scroll
                                on mobile. */}
                            {/* Mobile: flex-none + w-max so the chips size to
                                their content and ride the row scroll (flex-1's
                                zero basis would squeeze them over the sort
                                control). Desktop: grow + wrap. */}
                            <div className='flex items-center gap-1.5 max-md:w-max max-md:flex-none max-md:flex-nowrap md:min-w-0 md:flex-1 md:flex-wrap'>
                                {categories.map(cat => {
                                    const active =
                                        optimisticCategories.includes(cat.slug);
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
                                            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-it-full border border-transparent px-[13px] py-[9px] text-[13px] font-semibold leading-[1.6] transition-colors duration-(--it-duration-xs) ease-(--it-ease) ${
                                                active
                                                    ? 'bg-it-primary-subtle text-it-primary-hover'
                                                    : 'bg-transparent text-it-ink hover:bg-it-bg'
                                            }`}>
                                            {cat.label}
                                        </motion.button>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Sort - pinned right on desktop, flows inline below lg */}
                    <div className='flex shrink-0 items-center lg:ml-auto'>
                        <Popover open={sortOpen} onOpenChange={setSortOpen}>
                            <PopoverTrigger asChild>
                                <motion.button
                                    type='button'
                                    className='flex cursor-pointer items-center gap-[7px] whitespace-nowrap border-none bg-transparent px-1.5 py-[9px] text-[13.5px] font-bold leading-[1.6] text-it-ink'>
                                    <span className='font-semibold text-it-text-muted'>
                                        {dict.sortBy}
                                    </span>
                                    {sortDict[sort]}
                                    <Image
                                        src='/icons/filters/chevron-soft.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className={`size-3.5 shrink-0 transition-transform duration-(--it-duration-sm) ease-(--it-ease) ${sortOpen ? 'rotate-180' : ''}`}
                                    />
                                </motion.button>
                            </PopoverTrigger>
                            <PopoverContent
                                align='end'
                                sideOffset={8}
                                className='w-[230px] rounded-it-md border-none bg-it-white p-2 text-it-ink shadow-it-lg duration-300 ease-(--it-ease)'>
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
                                        className={`flex w-full cursor-pointer items-center justify-between rounded-it-sm border-none bg-transparent px-3 py-2.5 text-left text-[13.5px] leading-[1.6] transition-colors duration-(--it-duration-xs) hover:bg-it-bg ${
                                            opt.value === sort
                                                ? 'font-bold text-it-primary-hover'
                                                : 'font-semibold text-it-ink'
                                        }`}>
                                        {opt.label}
                                        {opt.value === sort && (
                                            <Image
                                                src='/icons/filters/check-deep.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-[15px] shrink-0'
                                            />
                                        )}
                                    </motion.button>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>
            </div>

            {/* ── Grid head (.gridhead) - counter + applied chips + clear all.
                Mobile: one scrolling strip (clear-all reachable by scroll). ── */}
            <div
                ref={metaRowRef}
                className='it-container flex items-center gap-3 overflow-x-auto pt-[18px] pb-3.5 [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden'>
                <p className='m-0 shrink-0 whitespace-nowrap text-[14px] font-bold leading-[1.6] text-it-ink tabular-nums'>
                    {counterLabel} {dict.toursWord}
                </p>

                <AnimatePresence initial={false}>
                    {chips.map(chip => (
                        <motion.button
                            key={chip.slug}
                            type='button'
                            onClick={() => removeChip(chip.slug)}
                            layout
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{
                                opacity: 0,
                                scale: 0.9,
                                transition: { duration: 0.1 },
                            }}
                            whileTap={{ scale: 0.95 }}
                            className='inline-flex shrink-0 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-it-full border border-it-primary/25 bg-it-primary-subtle px-[11px] py-1.5 text-[12.5px] font-bold leading-[1.2] text-it-primary-hover'>
                            {chip.label}
                            <Image
                                src='/icons/filters/close-deep.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-3 shrink-0'
                            />
                        </motion.button>
                    ))}
                </AnimatePresence>

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
                            className='shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[12.5px] font-bold leading-[1.6] text-it-text-muted underline underline-offset-2'>
                            {dict.clearAll}
                        </motion.button>
                    )}
                </AnimatePresence>
            </div>

            {/* Filters modal - rendered OUTSIDE the sticky band: the band's
                backdrop-filter creates a containing block, which would trap
                the modal's `position: fixed` inside it. */}
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
        </>
    );
}

