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
import { useFinePointer } from '@/hooks/use-fine-pointer';
import { useScrollOverflow } from '@/hooks/use-scroll-overflow';
import type { Currency, Locale } from '@/lib/constants/locales';
import { formatPlural, type PluralForms } from '@/lib/i18n/plural';
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
     * chip summary (e.g. "2 Adults & 3 Children") - ICU plural categories,
     * resolved via `formatPlural` so "1 Adult" reads singular.
     */
    guestTypes: {
        adults: { label: string; hint: string; word: PluralForms };
        children: { label: string; hint: string; word: PluralForms };
        infants: { label: string; hint: string; word: PluralForms };
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

// Edge fade over the category track. `pointer-events-none` is load-bearing: the
// fade sits ON TOP of the first/last chip, and without it that chip stops taking
// clicks. `-inset-y-1`/`-left-1` cover the track's focus-ring padding (see the
// `-m-1 p-1` pair below) so no unfaded sliver shows at either end.
const TRACK_FADE =
    'pointer-events-none absolute -inset-y-1 w-10 to-transparent transition-opacity duration-(--it-duration-sm) ease-(--it-ease)';

/**
 * Category quick-filter chips - ONE line, always (master 3.12: "horizontal
 * scroll on overflow"). Wrapping onto a second line pushes the rest of the
 * toolbar down and breaks the single-row band.
 *
 * ONLY this track scrolls: Date / Travelers / Filters / Sort live outside it and
 * never move when the chips do. Trackpad, touch and mouse-drag all come from
 * `useDragScroll`; tab-focusing a chip that sits off screen scrolls it back into
 * view, and the track carries 4px of padding (cancelled by `-m-1`) so the focus
 * ring is never clipped by its own overflow.
 *
 * The chevrons are gated on POINTER CAPABILITY, not width: a narrow desktop
 * window is still mouse-only and needs them, a touch laptop already swipes and
 * must not get them.
 */
function CategoryChipTrack({
    categories,
    selected,
    onToggle,
    onPrefetch,
}: {
    categories: FilterCategory[];
    /** Optimistic selection - the chips settle to server truth after the nav. */
    selected: string[];
    onToggle: (cat: FilterCategory) => void;
    onPrefetch: (cat: FilterCategory) => void;
}) {
    const trackRef = useDragScroll<HTMLDivElement>();
    const { left, right, scrollByPage } = useScrollOverflow(trackRef);
    const finePointer = useFinePointer();

    return (
        <div className='relative flex min-w-0 items-center max-md:w-full md:flex-1'>
            <div
                ref={trackRef}
                className='-m-1 flex items-center gap-1.5 overflow-x-auto scroll-px-1 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                {categories.map(cat => {
                    const active = selected.includes(cat.slug);
                    return (
                        <motion.button
                            key={cat.slug}
                            type='button'
                            aria-pressed={active}
                            onClick={() => onToggle(cat)}
                            onPointerEnter={() => onPrefetch(cat)}
                            onFocus={event => {
                                onPrefetch(cat);
                                // Keyboard users must never focus something they
                                // cannot see. `nearest` on both axes moves the
                                // track the minimum needed and leaves the page
                                // scroll alone.
                                event.currentTarget.scrollIntoView({
                                    block: 'nearest',
                                    inline: 'nearest',
                                });
                            }}
                            whileTap={{ scale: 0.99 }}
                            transition={springPop}
                            className={`shrink-0 cursor-pointer whitespace-nowrap rounded-it-full border border-transparent px-[11px] py-[7px] text-[12.5px] font-semibold leading-[1.6] transition-colors duration-(--it-duration-xs) ease-(--it-ease) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary md:px-[13px] md:py-[9px] md:text-[13px] ${
                                active
                                    ? 'bg-it-primary-subtle text-it-primary-hover'
                                    : 'bg-transparent text-it-ink hover:bg-it-bg'
                            }`}>
                            {cat.label}
                        </motion.button>
                    );
                })}
            </div>

            {/* Fades: right while more chips wait to the right, left once you
                have scrolled away from the start. */}
            <span
                aria-hidden='true'
                className={cn(
                    TRACK_FADE,
                    '-left-1 bg-linear-to-r from-(--it-frow-bg)',
                    left ? 'opacity-100' : 'opacity-0'
                )}
            />
            <span
                aria-hidden='true'
                className={cn(
                    TRACK_FADE,
                    '-right-1 bg-linear-to-l from-(--it-frow-bg)',
                    right ? 'opacity-100' : 'opacity-0'
                )}
            />

            {finePointer && left && (
                <TrackScrollButton
                    direction={-1}
                    label='Scroll categories left'
                    onScroll={scrollByPage}
                />
            )}
            {finePointer && right && (
                <TrackScrollButton
                    direction={1}
                    label='Scroll categories right'
                    onScroll={scrollByPage}
                />
            )}
        </div>
    );
}

/** Prev/next disc over the chip track's edge fade (mouse-only devices). */
function TrackScrollButton({
    direction,
    label,
    onScroll,
}: {
    direction: 1 | -1;
    label: string;
    onScroll: (direction: 1 | -1) => void;
}) {
    return (
        <motion.button
            type='button'
            aria-label={label}
            onClick={() => onScroll(direction)}
            whileTap={{ scale: 0.9 }}
            transition={springPop}
            className={`absolute top-1/2 z-1 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-it-full border border-it-border bg-it-white shadow-it-sm ${
                direction === -1 ? 'left-0' : 'right-0'
            }`}>
            <Image
                src='/icons/filters/pager-arrow-ink.svg'
                alt=''
                width={24}
                height={24}
                className={`size-3.5 shrink-0 ${direction === -1 ? 'rotate-180' : ''}`}
            />
        </motion.button>
    );
}

/**
 * Tours filter & sort toolbar - design v2 `.frow` + `.gridhead`.
 *
 * The filter row is a full-width band, sticky under the navbar (backdrop blur +
 * hairline): Date / Travelers / Filters control chips, a vertical divider, then
 * the category quick-filter chips. Below md the controls keep line 1 and the
 * category track takes line 2; each scrolls on its own, so the controls never
 * move when the chips do.
 *
 * The grid head below it (inside the container) carries the result counter,
 * the applied category chips (removable pills), "Clear all" - and Sort, pinned
 * to its right edge.
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
    // fits. Mobile only: the control strip and the grid head each scroll as one
    // strip. The category chips have their own track (`CategoryChipTrack`).
    const controlsRef = useDragScroll<HTMLDivElement>();
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

    // Chip summary - only non-zero types, e.g. "2 Adults & 3 Children" ("1 Adult"
    // singular at one, via ICU plural categories).
    const guestParts = (['adults', 'children', 'infants'] as const)
        .filter(type => guests[type] > 0)
        .map(
            type =>
                `${guests[type]} ${formatPlural(dict.guestTypes[type].word, guests[type], locale)}`
        );
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
            {/* ── Sticky toolbar (.frow + .gridhead) - the filter row AND the
                grid head ride under the navbar as ONE surface, so the applied
                filters, the count and Sort stay reachable down a long grid.
                One band, therefore one hairline, at its bottom edge. ── */}
            <div className='sticky top-16 z-35 mt-3.5 border-b border-it-divider bg-(--it-frow-bg) py-3 backdrop-blur-[8px]'>
                {/* Filter row: one line on desktop; below md the controls keep
                    line 1 and the category track drops to line 2 (four controls
                    plus the chips cannot share 390px, and the chips are the
                    half that must never wrap). */}
                <div className='it-container flex items-center gap-2.5 max-md:flex-wrap max-md:gap-y-2.5'>
                    {/* Control strip - Date / Travelers / Filters / Sort. Its
                        own scrolling line below md; at md+ `display: contents`
                        dissolves the wrapper so all four sit directly in the
                        row and the toolbar is a single line. */}
                    <div
                        ref={controlsRef}
                        className='flex min-w-0 flex-1 items-center gap-2.5 overflow-x-auto [scrollbar-width:none] md:contents [&::-webkit-scrollbar]:hidden'>
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
                                        onClick={() =>
                                            applyState({ date: null })
                                        }
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
                                        [
                                            'adults',
                                            'children',
                                            'infants',
                                        ] as const
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
                                                        className='grid size-[30px] cursor-pointer place-items-center rounded-full border border-it-border bg-it-white text-[16px] font-bold text-it-ink disabled:cursor-default disabled:opacity-30'>
                                                        +
                                                    </motion.button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                    <motion.button
                                        type='button'
                                        onClick={() =>
                                            onGuestsOpenChange(false)
                                        }
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
                                activeFilterCount > 0
                                    ? CHIP_ACTIVE
                                    : CHIP_INACTIVE
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
                    </div>

                    {!lockCategory && categories.length > 0 && (
                        <>
                            {/* Vertical divider between controls and chips -
                                desktop only; below md the two sit on their own
                                lines and a rule between them means nothing. */}
                            <span
                                className='mx-1 w-px shrink-0 self-stretch bg-it-border max-md:hidden'
                                aria-hidden='true'
                            />

                            {/* Category quick-filter chips - one scrolling line,
                                never wrapping. */}
                            <CategoryChipTrack
                                categories={categories}
                                selected={optimisticCategories}
                                onToggle={toggleCategory}
                                onPrefetch={cat => {
                                    // Prefetch the toggled-on result (the common
                                    // intent); an active chip's click removes it,
                                    // which is not worth a warm fetch.
                                    if (optimisticCategories.includes(cat.slug))
                                        return;
                                    prefetchState({
                                        categories: [
                                            ...optimisticCategories,
                                            cat.slug,
                                        ],
                                    });
                                }}
                            />
                        </>
                    )}
                </div>

                {/* Grid head (.gridhead) - counter + applied chips + clear all,
                    with Sort pinned right. Sort sits HERE rather than in the
                    filter row (master 3.12 draws it in the row) so the band
                    above is the category track's alone and the chips get the
                    full width. */}
                <div className='it-container flex flex-wrap items-center gap-3 gap-y-2.5 pt-3.5'>
                    <p className='m-0 shrink-0 whitespace-nowrap text-[14px] font-bold leading-[1.6] text-it-ink tabular-nums'>
                        {counterLabel} {dict.toursWord}
                    </p>

                    {/* Sort - right edge of the counter row. */}
                    <div className='ml-auto flex shrink-0 items-center'>
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

                    {/* Applied chips + clear all - their own line ABOVE the counter
                    at every width (`order-first`): four pills alongside the
                    counter and Sort crowd the row and clip on the way out. One
                    scrolling strip on mobile so a long selection stays
                    reachable; wraps at md+. `empty:hidden` because with no
                    filters applied this renders no children at all, and the row
                    gap alone would leave a dead 10px band. */}
                    <div
                        ref={metaRowRef}
                        className='order-first flex w-full min-w-0 items-center gap-3 overflow-x-auto empty:hidden [scrollbar-width:none] md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden'>
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
                </div>
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
