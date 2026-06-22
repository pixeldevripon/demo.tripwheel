'use client';

import { format } from 'date-fns';
import { Minus, Plus } from 'lucide-react';
import Image from 'next/image';
import { useState } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
    Checkbox,
    PriceRange,
    PRICE_MAX,
    PRICE_MIN,
    type ToursFilterModalDict,
} from '@/components/frontend/tours-filter-modal';

export type CategoryFilterDict = {
    /** Dimension pill labels. */
    date: string;
    duration: string;
    price: string;
    groupSize: string;
    language: string;
    /** "Active Filters:" prefix on the chips row. */
    activeFilters: string;
    /** Clear-all action label. */
    clearAll: string;
    /** Group-size popover. */
    groupSizeLabel: string;
    groupSizeHint: string;
    /** Guide-language popover. */
    guideLanguageTitle: string;
    languages: {
        en: string;
        es: string;
        nl: string;
        pap: string;
        fr: string;
        de: string;
        pt: string;
    };
};

export type CategoryPill = { label: string; slug: string };

const LANGUAGE_ORDER = ['en', 'es', 'nl', 'pap', 'fr', 'de', 'pt'] as const;
const DURATION_KEYS = ['upTo2', '2to4', '4to6', 'fullDay'] as const;

/* ── Shared atom styles ────────────────────────────────────────────── */

const PILL =
    'flex h-9.5 md:h-12.5 shrink-0 cursor-pointer items-center gap-2 rounded-it-full border px-3 md:px-6 py-2 md:py-3 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] whitespace-nowrap text-it-heading transition-colors';
const PILL_ICON = 'size-5 md:size-6 shrink-0';
const PILL_ON = 'border-it-heading bg-[#f7f7f7]';
const PILL_OFF = 'border-it-heading/10 bg-transparent hover:bg-it-surface';
const POPOVER =
    'rounded-[10px] border-none bg-it-white text-it-heading shadow-[5px_10px_24px_-4px_rgba(0,0,0,0.16)]';
const POPOVER_TITLE =
    'm-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading';

/**
 * Second-listing filter bar (Figma node 47171:1499 → 2147227674). A structurally
 * independent twin of the top <ToursFilterBar>: a horizontally-scrollable row of
 * dimension pills + category pills, above an "Active Filters" chips row.
 *
 * Each dimension pill opens its own popover:
 *   - Date       → single-date calendar (same control as the top filter bar)
 *   - Duration   → duration checkboxes
 *   - Price      → dual-handle price range
 *   - Group Size → travelers stepper
 *   - Language   → guide-language checkboxes (NOT the site locale)
 *
 * Selection is local for now (the per-attribute filter API lands later). A pill
 * with a value shows the active style and a removable chip in the row below.
 */
export function CategoryFilterBar({
    dict,
    filterDict,
    categories,
}: {
    dict: CategoryFilterDict;
    /** Reused for the localized duration option labels. */
    filterDict: ToursFilterModalDict;
    categories: CategoryPill[];
}) {
    const [date, setDate] = useState<Date | undefined>(undefined);
    const [dateOpen, setDateOpen] = useState(false);
    const [durations, setDurations] = useState<string[]>([]);
    const [price, setPrice] = useState<[number, number]>([PRICE_MIN, PRICE_MAX]);
    const [groupSize, setGroupSize] = useState(0);
    const [languages, setLanguages] = useState<string[]>([]);
    const [selectedCat, setSelectedCat] = useState(categories[0]?.slug ?? '');

    const toggle = (set: (fn: (a: string[]) => string[]) => void, v: string) =>
        set((a) => (a.includes(v) ? a.filter((x) => x !== v) : [...a, v]));

    const priceActive = price[0] > PRICE_MIN || price[1] < PRICE_MAX;

    // Active dimensions → removable chips (Figma "Active Filters" row).
    const chips = [
        date && { key: 'date', label: dict.date, clear: () => setDate(undefined) },
        durations.length > 0 && { key: 'duration', label: dict.duration, clear: () => setDurations([]) },
        priceActive && { key: 'price', label: dict.price, clear: () => setPrice([PRICE_MIN, PRICE_MAX]) },
        groupSize > 0 && { key: 'groupSize', label: dict.groupSize, clear: () => setGroupSize(0) },
        languages.length > 0 && { key: 'language', label: dict.language, clear: () => setLanguages([]) },
    ].filter(Boolean) as { key: string; label: string; clear: () => void }[];

    const clearAll = () => {
        setDate(undefined);
        setDurations([]);
        setPrice([PRICE_MIN, PRICE_MAX]);
        setGroupSize(0);
        setLanguages([]);
    };

    const durationItems = DURATION_KEYS.map((key) => ({
        key,
        label: filterDict.durations[key],
    }));

    return (
        // Toolbar → chips row: 16px mobile / 24px md+ (Figma).
        <div className='flex flex-col gap-4 md:gap-6'>
            {/* Toolbar - mobile: two stacked scroll rows; md+: one scroll row. */}
            <div className='flex flex-col gap-2 md:flex-row md:items-center md:gap-4 md:overflow-x-auto md:pb-1 md:[scrollbar-width:none] md:[&::-webkit-scrollbar]:hidden'>
                {/* Dimension pills - own scroll row on mobile */}
                <div className='flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:overflow-visible md:pb-0 md:shrink-0'>
                    {/* Date - calendar popover (same control as the top filter bar). */}
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                        <PopoverTrigger asChild>
                            <button type='button' className={`${PILL} ${date ? PILL_ON : PILL_OFF}`}>
                                <Image src='/icons/filters/calendar.svg' alt='' width={24} height={24} className={PILL_ICON} />
                                {date ? format(date, 'd MMM') : dict.date}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align='start' sideOffset={12} className={`w-auto p-0 ${POPOVER}`}>
                            <Calendar
                                mode='single'
                                selected={date}
                                onSelect={(d) => {
                                    setDate(d);
                                    setDateOpen(false);
                                }}
                                disabled={{ before: new Date() }}
                                autoFocus
                                className='bg-it-white [--cell-radius:8px]'
                            />
                        </PopoverContent>
                    </Popover>

                    {/* Duration - checkbox popover. */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type='button' className={`${PILL} ${durations.length > 0 ? PILL_ON : PILL_OFF}`}>
                                <Image src='/icons/filters/routing.svg' alt='' width={24} height={24} className={PILL_ICON} />
                                {dict.duration}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align='start' sideOffset={12} className={`w-72 p-4 ${POPOVER}`}>
                            <div className='flex flex-col gap-4'>
                                <h4 className={POPOVER_TITLE}>{dict.duration}</h4>
                                <div className='flex flex-col gap-3'>
                                    {durationItems.map((item) => (
                                        <Checkbox
                                            key={item.key}
                                            label={item.label}
                                            checked={durations.includes(item.key)}
                                            onChange={() => toggle(setDurations, item.key)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Price - dual-handle range popover. */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type='button' className={`${PILL} ${priceActive ? PILL_ON : PILL_OFF}`}>
                                <Image src='/icons/filters/coin.svg' alt='' width={24} height={24} className={PILL_ICON} />
                                {dict.price}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align='start' sideOffset={12} className={`w-80 p-4 ${POPOVER}`}>
                            <div className='flex flex-col gap-4'>
                                <h4 className={POPOVER_TITLE}>{dict.price}</h4>
                                <PriceRange value={price} onChange={setPrice} />
                                <div className='flex items-center justify-between text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    <span>${price[0]}</span>
                                    <span>${price[1]}</span>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Group Size - travelers stepper popover. */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type='button' className={`${PILL} ${groupSize > 0 ? PILL_ON : PILL_OFF}`}>
                                <Image src='/icons/filters/people.svg' alt='' width={24} height={24} className={PILL_ICON} />
                                {dict.groupSize}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align='start' sideOffset={12} className={`w-72 p-4 ${POPOVER}`}>
                            <div className='flex items-center justify-between'>
                                <div className='flex flex-col'>
                                    <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        {dict.groupSizeLabel}
                                    </span>
                                    <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                        {dict.groupSizeHint}
                                    </span>
                                </div>
                                <div className='flex items-center gap-3'>
                                    <button
                                        type='button'
                                        aria-label='Decrease group size'
                                        disabled={groupSize <= 0}
                                        onClick={() => setGroupSize((n) => Math.max(0, n - 1))}
                                        className='grid size-8 place-items-center rounded-full border border-it-heading/20 bg-it-white text-it-heading transition-colors hover:bg-it-surface disabled:cursor-not-allowed disabled:opacity-30'>
                                        <Minus className='size-4' strokeWidth={1.5} />
                                    </button>
                                    <span className='min-w-5 text-center text-[16px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        {groupSize}
                                    </span>
                                    <button
                                        type='button'
                                        aria-label='Increase group size'
                                        disabled={groupSize >= 20}
                                        onClick={() => setGroupSize((n) => Math.min(20, n + 1))}
                                        className='grid size-8 place-items-center rounded-full border border-it-heading/20 bg-it-white text-it-heading transition-colors hover:bg-it-surface disabled:cursor-not-allowed disabled:opacity-30'>
                                        <Plus className='size-4' strokeWidth={1.5} />
                                    </button>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* Language - guide-language checkbox popover (not the site locale). */}
                    <Popover>
                        <PopoverTrigger asChild>
                            <button type='button' className={`${PILL} ${languages.length > 0 ? PILL_ON : PILL_OFF}`}>
                                <Image src='/icons/filters/global.svg' alt='' width={24} height={24} className={PILL_ICON} />
                                {dict.language}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent align='start' sideOffset={12} className={`w-72 p-4 ${POPOVER}`}>
                            <div className='flex flex-col gap-4'>
                                <h4 className={POPOVER_TITLE}>{dict.guideLanguageTitle}</h4>
                                <div className='flex flex-col gap-3'>
                                    {LANGUAGE_ORDER.map((key) => (
                                        <Checkbox
                                            key={key}
                                            label={dict.languages[key]}
                                            checked={languages.includes(key)}
                                            onChange={() => toggle(setLanguages, key)}
                                        />
                                    ))}
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>

                {/* Category group - divider + pills; own scroll row on mobile.
                    On mobile this wraps to a second row (the divider leads it). */}
                <div className='flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:gap-4 md:overflow-visible md:pb-0 md:shrink-0'>
                    {/* Divider - 28px grey on mobile, 34px faint on md+. */}
                    <div className='h-7 w-px shrink-0 bg-it-text-muted md:h-8.5 md:bg-it-heading/10' aria-hidden='true' />

                    {/* Category pills - single-select. */}
                    <div className='flex items-center gap-1 md:gap-2'>
                        {categories.map((cat) => {
                            const selected = cat.slug === selectedCat;
                            return (
                                <button
                                    key={cat.slug}
                                    type='button'
                                    onClick={() => setSelectedCat(cat.slug)}
                                    className={`${PILL} ${
                                        selected ? 'border-transparent bg-it-heading/10' : PILL_OFF
                                    }`}>
                                    {cat.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Active Filters row - 32px between the chips group and Clear-all. */}
            {chips.length > 0 && (
                <div className='flex flex-wrap items-center gap-x-8 gap-y-3'>
                    <div className='flex flex-wrap items-center gap-2 md:gap-4'>
                        <span className='whitespace-nowrap text-[14px] font-medium leading-[1.6] tracking-[-0.012em] text-it-heading md:text-[16px]'>
                            {dict.activeFilters}
                        </span>
                        <div className='flex flex-wrap items-center gap-1 md:gap-2'>
                            {chips.map((chip) => (
                                <span
                                    key={chip.key}
                                    className='flex items-center gap-0.75 rounded-it-full border border-it-heading/10 bg-it-surface px-3 py-1 md:px-5 md:py-1.25'>
                                    <span className='whitespace-nowrap text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted md:text-[16px]'>
                                        {chip.label}
                                    </span>
                                    <button
                                        type='button'
                                        onClick={chip.clear}
                                        aria-label={`Remove ${chip.label}`}
                                        className='inline-flex cursor-pointer items-center border-none bg-transparent p-0'>
                                        <Image src='/icons/filters/close-circle-muted.svg' alt='' width={24} height={24} className='size-6' />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                    <button
                        type='button'
                        onClick={clearAll}
                        className='hidden cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[16px] font-medium leading-[1.6] tracking-[-0.012em] text-it-primary md:inline-flex'>
                        {dict.clearAll}
                    </button>
                </div>
            )}
        </div>
    );
}
