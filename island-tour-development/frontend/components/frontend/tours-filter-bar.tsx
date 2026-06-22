'use client';

import { format } from 'date-fns';
import { Minus, Plus } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    countActiveFilters,
    EMPTY_FILTERS,
    type TourFilters,
    type ToursFilterModalDict,
    ToursFilterModal,
} from '@/components/frontend/tours-filter-modal';

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

export type SortValue = 'localsFavorites' | 'priceLowHigh' | 'priceHighLow';

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
    /** Initial guest count on the adults pill (min 1). */
    guestCount: number;
    /** Result counter - shown vs total. */
    shown: number;
    total: number;
    /** Category slugs pre-selected (highlighted) on first render. */
    initialSelected?: string[];
    /** Applied-filter chips shown on first render. */
    initialChips?: FilterCategory[];
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
    guestCount,
    shown,
    total,
    initialSelected = [],
    initialChips = [],
}: ToursFilterBarProps) {
    const [selected, setSelected] = useState<Set<string>>(
        () => new Set(initialSelected),
    );
    const [chips, setChips] = useState<FilterCategory[]>(initialChips);

    // Date picker + guest stepper state (search controls).
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [dateOpen, setDateOpen] = useState(false);
    const [guests, setGuests] = useState({
        adults: Math.max(1, guestCount),
        children: 0,
        infants: 0,
    });
    const [guestsOpen, setGuestsOpen] = useState(false);

    type GuestType = keyof typeof guests;
    const stepGuest = (type: GuestType, delta: number) =>
        setGuests((g) => ({
            ...g,
            [type]: Math.min(20, Math.max(type === 'adults' ? 1 : 0, g[type] + delta)),
        }));

    // Chip summary - only non-zero types, e.g. "2 adults & 3 children".
    const guestParts = (['adults', 'children', 'infants'] as const)
        .filter((type) => guests[type] > 0)
        .map((type) => `${guests[type]} ${dict.guestTypes[type].word}`);
    const guestsLabel =
        guestParts.length <= 1
            ? guestParts[0]
            : `${guestParts.slice(0, -1).join(', ')} & ${guestParts.at(-1)}`;

    // Filters modal state - the Filters pill opens it; applied filters drive the badge.
    const [filterOpen, setFilterOpen] = useState(false);
    const [appliedFilters, setAppliedFilters] = useState<TourFilters>(EMPTY_FILTERS);
    const activeFilterCount = countActiveFilters(appliedFilters);

    // Default option carries the "(Default)" suffix only inside the dropdown.
    const sortOptions: { value: SortValue; label: string }[] = [
        {
            value: 'localsFavorites',
            label: `${sortDict.localsFavorites} ${sortDict.defaultSuffix}`,
        },
        { value: 'priceLowHigh', label: sortDict.priceLowHigh },
        { value: 'priceHighLow', label: sortDict.priceHighLow },
    ];
    const [sort, setSort] = useState<SortValue>('localsFavorites');
    const [sortOpen, setSortOpen] = useState(false);

    function toggleCategory(cat: FilterCategory) {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(cat.slug)) next.delete(cat.slug);
            else next.add(cat.slug);
            return next;
        });
        setChips((prev) =>
            prev.some((c) => c.slug === cat.slug)
                ? prev.filter((c) => c.slug !== cat.slug)
                : [...prev, cat],
        );
    }

    function removeChip(slug: string) {
        setChips((prev) => prev.filter((c) => c.slug !== slug));
        setSelected((prev) => {
            const next = new Set(prev);
            next.delete(slug);
            return next;
        });
    }

    function clearAll() {
        setChips([]);
        setSelected(new Set());
    }

    const counterLabel = dict.resultsCount
        .replace('{shown}', String(shown))
        .replace('{total}', String(total));

    return (
        <div className='flex flex-col gap-6'>
            {/* ── Row 1 - controls + category pills (scrolls horizontally) ── */}
            <div className='flex items-center gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
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
                                        setDate(selected);
                                        setDateOpen(false);
                                    }}
                                    disabled={{ before: new Date() }}
                                    autoFocus
                                    className='bg-it-white [--cell-radius:8px]'
                                />
                            </PopoverContent>
                        </Popover>

                        {/* Guests - stepper popover */}
                        <Popover open={guestsOpen} onOpenChange={setGuestsOpen}>
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
                                                        disabled={guests[type] <= min}
                                                        onClick={() => stepGuest(type, -1)}
                                                        className='grid size-8 place-items-center rounded-full border border-it-heading/20 bg-it-white text-it-heading transition-colors hover:bg-it-surface disabled:cursor-not-allowed disabled:opacity-30'>
                                                        <Minus className='size-4' strokeWidth={1.5} />
                                                    </button>
                                                    <span className='min-w-5 text-center text-[16px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                        {guests[type]}
                                                    </span>
                                                    <button
                                                        type='button'
                                                        aria-label={`Increase ${type}`}
                                                        disabled={guests[type] >= 20}
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
                            value={appliedFilters}
                            onApply={(f) => {
                                setAppliedFilters(f);
                                setFilterOpen(false);
                            }}
                        />
                    </div>

                    <span className='h-8.5 w-px shrink-0 bg-it-heading/20' aria-hidden='true' />
                </div>

                {/* Category quick-filter pills */}
                <div className='flex shrink-0 items-center gap-2'>
                    {categories.map((cat) => {
                        const active = selected.has(cat.slug);
                        return (
                            <button
                                key={cat.slug}
                                type='button'
                                aria-pressed={active}
                                onClick={() => toggleCategory(cat)}
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
            </div>

            {/* ── Row 2 - counter + chips + clear all · sort ──────────────────
                Mobile: counter/chips/clear-all scroll horizontally (clear-all sits
                off-screen, reachable by scroll); sort stays pinned right. */}
            <div className='flex items-center gap-3 md:flex-wrap md:justify-between md:gap-x-8 md:gap-y-4'>
                {/* Left - counter, applied chips, clear all */}
                <div className='flex min-w-0 flex-1 items-center gap-3 overflow-x-auto pb-1 [scrollbar-width:none] md:flex-auto md:flex-wrap md:overflow-visible md:gap-x-8 md:gap-y-3 md:pb-0 [&::-webkit-scrollbar]:hidden'>
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

                    {chips.length > 0 && (
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
                                        setSort(opt.value);
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
