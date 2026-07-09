'use client';

import { format, parse } from 'date-fns';
import { Minus, Plus } from 'lucide-react';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useOptimistic, useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    countActiveFilters,
    EMPTY_FILTERS,
    type TourFilters,
    type ToursFilterModalDict,
    ToursFilterModal,
} from '@/components/frontend/tours-filter-modal';
import { useToursNav } from '@/components/frontend/tours/tours-browser';
import { useDragScroll } from '@/hooks/use-drag-scroll';
import {
    buildToursHref,
    DEFAULT_GUESTS,
    PRICE_MAX,
    PRICE_MIN,
    type ToursFilterState,
    type ToursGuests,
    type ToursSortValue,
} from '@/lib/tours/filters';

/* ── Dictionary shapes ─────────────────────────────────────────────── */

export type ToursToolbarDict = {
    /** Label on the filters control pill - e.g. "Filters" */
    filters: string;
    /** Date pill placeholder when no date is picked - e.g. "Select date" */
    selectDate: string;
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
    /**
     * Active dynamic attribute filters (from the URL). No modal UI sets these, but
     * the toolbar preserves them across navigations so URL/deep-link attribute
     * filters survive sort/category/price changes.
     */
    attributes?: Record<string, string[]>;
}

/* ── Shared atom styles ────────────────────────────────────────────── */

const PILL_BASE =
    'flex h-9.5 md:h-12.5 shrink-0 items-center gap-2 rounded-it-full px-3 md:px-6 py-2 md:py-3 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors';

/**
 * Tours filter & sort toolbar - matches Figma node 47167:4032.
 *
 * Row 1: date / guests / filters control pills + a divider + scrollable
 * category quick-filter pills. Row 2: result counter + applied-filter chips +
 * "Clear all" on the left, sort dropdown on the right.
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
    attributes = {},
}: ToursFilterBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { startNav } = useToursNav();

    // Grab-to-slide the horizontally-overflowing rows with a plain mouse (same
    // affordance as the tab bars); no-ops on touch and when the content fits.
    const controlsRowRef = useDragScroll<HTMLDivElement>();
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
            priceMax,
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
                priceMax,
            ),
        );

    // Selected categories rendered as removable chips in row 2 (multi-select).
    const chips = categories.filter((c) => optimisticCategories.includes(c.slug));

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
        setGuestDraft((g) => ({
            ...g,
            [type]: Math.min(20, Math.max(type === 'adults' ? 1 : 0, g[type] + delta)),
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
        .filter((type) => guests[type] > 0)
        .map((type) => `${guests[type]} ${dict.guestTypes[type].word}`);
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
            ? optimisticCategories.filter((s) => s !== cat.slug)
            : [...optimisticCategories, cat.slug];
        applyState({ categories: next });
    }

    function removeChip(slug: string) {
        applyState({
            categories: optimisticCategories.filter((s) => s !== slug),
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
            {/* ── Row 1 - controls + category pills (scrolls horizontally) ── */}
            <div
                ref={controlsRowRef}
                className='flex items-center gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                {/* Left group - control pills + vertical divider */}
                <div className='flex shrink-0 items-center gap-4'>
                    <div className='flex items-center gap-2'>
                        {/* Date - calendar popover */}
                        <Popover open={dateOpen} onOpenChange={setDateOpen}>
                            <PopoverTrigger asChild>
                                <button
                                    type='button'
                                    className={`${PILL_BASE} max-md:hidden border ${
                                        date
                                            ? 'border-it-heading bg-it-surface'
                                            : 'border-it-heading/10 bg-it-white hover:bg-it-surface'
                                    }`}>
                                    <Image
                                        src='/icons/filters/calendar.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-6 shrink-0'
                                    />
                                    {date ? format(date, 'd MMM') : dict.selectDate}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align='start'
                                sideOffset={12}
                                className='w-auto rounded-[10px] border-none bg-it-white p-0 text-it-heading shadow-[5px_10px_24px_-4px_rgba(0,0,0,0.16)]'>
                                <Calendar
                                    mode='single'
                                    selected={date}
                                    onSelect={(selected) => {
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
                        <Popover open={guestsOpen} onOpenChange={onGuestsOpenChange}>
                            <PopoverTrigger asChild>
                                <button
                                    type='button'
                                    className={`${PILL_BASE} border border-it-heading bg-it-surface`}>
                                    <Image
                                        src='/icons/filters/profile.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-5 md:size-6 shrink-0'
                                    />
                                    {guestsLabel}
                                </button>
                            </PopoverTrigger>
                            <PopoverContent
                                align='start'
                                sideOffset={12}
                                className='w-72 rounded-[10px] border-none bg-it-white p-4 text-it-heading shadow-[5px_10px_24px_-4px_rgba(0,0,0,0.16)]'>
                                <div className='flex flex-col gap-4'>
                                    {(['adults', 'children', 'infants'] as const).map((type) => {
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
                                                    <button
                                                        type='button'
                                                        aria-label={`Decrease ${type}`}
                                                        disabled={guestDraft[type] <= min}
                                                        onClick={() => stepGuest(type, -1)}
                                                        className='grid size-8 place-items-center rounded-full border border-it-heading/20 bg-it-white text-it-heading transition-colors hover:bg-it-surface disabled:cursor-not-allowed disabled:opacity-30'>
                                                        <Minus className='size-4' strokeWidth={1.5} />
                                                    </button>
                                                    <span className='min-w-5 text-center text-[16px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                        {guestDraft[type]}
                                                    </span>
                                                    <button
                                                        type='button'
                                                        aria-label={`Increase ${type}`}
                                                        disabled={guestDraft[type] >= 20}
                                                        onClick={() => stepGuest(type, 1)}
                                                        className='grid size-8 place-items-center rounded-full border border-it-heading/20 bg-it-white text-it-heading transition-colors hover:bg-it-surface disabled:cursor-not-allowed disabled:opacity-30'>
                                                        <Plus className='size-4' strokeWidth={1.5} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </PopoverContent>
                        </Popover>

                        {/* Filters - opens the Filters modal */}
                        <button
                            type='button'
                            onClick={() => setFilterOpen(true)}
                            className={`${PILL_BASE} border ${
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
                        </button>

                        <ToursFilterModal
                            open={filterOpen}
                            onClose={() => setFilterOpen(false)}
                            dict={filterDict}
                            hasReviews={hasReviews}
                            priceMax={priceMax}
                            value={activeFilters}
                            onApply={(f) => {
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

                {/* Category quick-filter pills - hidden on the category page (route
                    fixes the category). */}
                {!lockCategory && (
                    <div className='flex shrink-0 items-center gap-2'>
                        {categories.map((cat) => {
                            const active = optimisticCategories.includes(cat.slug);
                            // Prefetch the toggled-on result (the common intent).
                            const prefetch = () =>
                                !active &&
                                prefetchState({
                                    categories: [...optimisticCategories, cat.slug],
                                });
                            return (
                                <button
                                    key={cat.slug}
                                    type='button'
                                    aria-pressed={active}
                                    onClick={() => toggleCategory(cat)}
                                    onPointerEnter={prefetch}
                                    onFocus={prefetch}
                                    className={`${PILL_BASE} ${
                                        active
                                            ? 'bg-it-heading/10'
                                            : 'border border-it-heading/10 bg-it-white hover:bg-it-surface'
                                    }`}>
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Row 2 - counter + chips + clear all · sort ──────────────────
                Mobile: counter/chips/clear-all scroll horizontally (clear-all sits
                off-screen, reachable by scroll); sort stays pinned right. */}
            <div className='flex items-center gap-3 md:flex-wrap md:justify-between md:gap-x-8 md:gap-y-4'>
                {/* Left - counter, applied chips, clear all */}
                <div
                    ref={metaRowRef}
                    className='flex min-w-0 flex-1 items-center gap-3 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-auto md:flex-wrap md:overflow-visible md:gap-x-8 md:gap-y-3 md:pb-0 [&::-webkit-scrollbar]:hidden'>
                    <div className='flex shrink-0 items-center gap-2 md:flex-wrap md:gap-x-4 md:gap-y-2'>
                        <p className='m-0 shrink-0 whitespace-nowrap text-[16px] leading-[1.6] tracking-[-0.012em]'>
                            <span className='font-medium text-it-heading'>{counterLabel}</span>{' '}
                            <span className='text-it-text-muted'>{dict.toursWord}</span>
                        </p>

                        {chips.length > 0 && (
                            <div className='flex shrink-0 items-center gap-2 md:flex-wrap'>
                                {chips.map((chip) => (
                                    <button
                                        key={chip.slug}
                                        type='button'
                                        onClick={() => removeChip(chip.slug)}
                                        className='inline-flex shrink-0 items-center gap-0.75 whitespace-nowrap rounded-it-full border border-it-heading/10 bg-it-surface py-1 pl-3 pr-2.5 text-[14px] md:py-1.25 md:pl-5 md:pr-3.5 md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted transition-colors hover:text-it-heading'>
                                        {chip.label}
                                        <Image
                                            src='/icons/filters/close-circle.svg'
                                            alt=''
                                            width={24}
                                            height={24}
                                            className='size-6 shrink-0'
                                        />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {(chips.length > 0 || activeFilterCount > 0) && (
                        <button
                            type='button'
                            onClick={clearAll}
                            className='shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[14px] font-medium leading-[1.6] tracking-[-0.012em] text-it-primary underline underline-offset-2 transition-colors hover:text-it-primary-hover md:text-[16px]'>
                            {dict.clearAll}
                        </button>
                    )}
                </div>

                {/* Right - sort dropdown (responsive text/spacing on mobile) */}
                <div className='flex max-md:hidden shrink-0 items-center gap-2 md:gap-3.5'>
                    <span className='whitespace-nowrap text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted md:text-[16px]'>
                        {dict.sortBy}
                    </span>
                    <Popover open={sortOpen} onOpenChange={setSortOpen}>
                        <PopoverTrigger asChild>
                            <button
                                type='button'
                                className='flex cursor-pointer items-center gap-1.5 whitespace-nowrap border-none bg-transparent p-0 text-[14px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading md:gap-2 md:text-[16px]'>
                                {sortDict[sort]}
                                <Image
                                    src='/icons/filters/chevron-down.svg'
                                    alt=''
                                    width={20}
                                    height={20}
                                    className={`size-4 shrink-0 transition-transform md:size-5 ${sortOpen ? 'rotate-180' : ''}`}
                                />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent
                            align='end'
                            sideOffset={12}
                            className='w-57.25 overflow-hidden rounded-[10px] border-none bg-it-white p-0 text-it-heading shadow-[5px_10px_24px_-4px_rgba(0,0,0,0.16)]'>
                            {sortOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    type='button'
                                    onClick={() => {
                                        applyState({ sort: opt.value });
                                        setSortOpen(false);
                                    }}
                                    className={`flex w-full cursor-pointer items-center border-none bg-transparent px-4 py-2 text-left text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors hover:bg-it-surface ${
                                        opt.value === sort ? 'font-medium' : ''
                                    }`}>
                                    {opt.label}
                                </button>
                            ))}
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
        </div>
    );
}
