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
import { springPop, swapFade } from '@/lib/motion';
import {
    buildToursHref,
    DEFAULT_GUESTS,
    PRICE_MAX,
    PRICE_MIN,
    TOURS_SORT_PROFILE,
    type SortProfile,
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

/** One label per {@link ToursSortValue}, keyed by the value itself. */
export type ToursSortDict = Record<ToursSortValue, string>;

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
     * Render the "{shown} of {total} tours" counter. Off on the SEARCH page,
     * whose heading already states the count - master 3.12's dual count is a
     * listing-page rule and repeating it there just says the same number twice.
     * With it off, Sort moves UP into the filter row - alone on a row of its
     * own it read as a control that had lost its label (mck-12 draws it in the
     * filter row too).
     */
    showCount?: boolean;
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
    /**
     * Which sorts this page offers and which one it defaults to. Defaults to the
     * listing profile; `/search` passes `SEARCH_SORT_PROFILE` so "Most relevant"
     * leads there and All Tours keeps Locals' favorites (Pastel #44).
     */
    sortProfile?: SortProfile;
    /**
     * Route-owned query params the toolbar must carry across every navigation
     * but does not model - `q` and `destination` on the search page. Dropping
     * them would turn a filter change into a search with no term.
     */
    extraParams?: Record<string, string | undefined>;
}

/* ── Shared atom styles (design v2) ────────────────────────────────── */

// Control chip (.fchip): bordered white pill, 13.5px bold; the active state
// swaps to the warm cta tint with the deep-orange text.
const CHIP_INACTIVE = 'border-it-border bg-it-white text-it-heading tracking-[-0.012em]';
const CHIP_ACTIVE =
    'border-it-primary bg-it-primary-subtle text-it-primary-hover tracking-[-0.012em]';
const CHIP_BASE =
    'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-it-full border text-[13px] md:text-[14.5px] leading-[1.6] transition-colors duration-(--it-duration-xs) ease-(--it-ease) tracking-[-0.012em]';

// Edge fade over the category track. `pointer-events-none` is load-bearing: the
// fade sits ON TOP of the first/last chip, and without it that chip stops taking
// clicks. `-inset-y-1`/`-left-1` cover the track's focus-ring padding (see the
// `-m-1 p-1` pair below) so no unfaded sliver shows at either end.
const TRACK_FADE =
    'pointer-events-none absolute -inset-y-1 w-10 to-transparent transition-opacity duration-(--it-duration-sm) ease-(--it-ease)';

/**
 * One horizontally-scrolling row of chips that NEVER wraps (master 3.12:
 * "horizontal scroll on overflow"). Wrapping pushes the rest of the toolbar
 * down and breaks the single-row band.
 *
 * ONLY the track scrolls - whatever sits beside it stays put. Trackpad, touch
 * and mouse-drag all come from `useDragScroll`; tab-focusing a chip that sits
 * off screen scrolls it back into view, and the track carries 4px of padding
 * (cancelled by `-m-1`) so the focus ring is never clipped by its own overflow.
 *
 * The chevrons are gated on POINTER CAPABILITY, not width: a narrow desktop
 * window is still mouse-only and needs them, a touch laptop already swipes and
 * must not get them.
 */
function ScrollTrack({
    /** Names the row in the chevrons' accessible labels ("Scroll {label} left"). */
    label,
    className,
    trackClassName,
    children,
}: {
    label: string;
    /** Layout of the wrapper inside the toolbar row. */
    className?: string;
    /** Gap (and any md+ wrap override) for the track itself. */
    trackClassName?: string;
    children: React.ReactNode;
}) {
    const trackRef = useDragScroll<HTMLDivElement>();
    const { left, right, scrollByPage } = useScrollOverflow(trackRef);
    const finePointer = useFinePointer();

    return (
        <div
            className={cn(
                'group relative flex min-w-0 items-center',
                className
            )}>
            <div
                ref={trackRef}
                className={cn(
                    '-m-1 flex items-center overflow-x-auto scroll-px-1 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                    trackClassName
                )}>
                {children}
            </div>

            {/* Fades: right while more waits to the right, left once you have
                scrolled away from the start. */}
            <span
                aria-hidden='true'
                className={cn(
                    TRACK_FADE,
                    '-left-1 bg-linear-to-r from-it-white',
                    left ? 'opacity-100' : 'opacity-0'
                )}
            />
            <span
                aria-hidden='true'
                className={cn(
                    TRACK_FADE,
                    '-right-1 bg-linear-to-l from-it-white',
                    right ? 'opacity-100' : 'opacity-0'
                )}
            />

            {finePointer && left && (
                <TrackScrollButton
                    direction={-1}
                    label={`Scroll ${label} left`}
                    onScroll={scrollByPage}
                />
            )}
            {finePointer && right && (
                <TrackScrollButton
                    direction={1}
                    label={`Scroll ${label} right`}
                    onScroll={scrollByPage}
                />
            )}
        </div>
    );
}

/** Category quick-filter chips, in a track that never wraps. */
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
    return (
        <ScrollTrack
            label='categories'
            className='max-md:w-full md:flex-1'
            trackClassName='gap-1.5'>
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
                        className={`shrink-0 cursor-pointer whitespace-nowrap rounded-it-full border border-transparent px-[11px] py-[7px] text-[13px] font-medium leading-[1.6] transition-colors duration-(--it-duration-xs) ease-(--it-ease) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary md:px-[13px] md:py-[9px] md:text-[14.5px] ${
                            active
                                ? 'bg-it-primary-subtle text-it-primary-hover tracking-[-0.012em]'
                                : 'bg-transparent text-it-heading hover:bg-it-bg tracking-[-0.012em]'
                        }`}>
                        {cat.label}
                    </motion.button>
                );
            })}
        </ScrollTrack>
    );
}

/**
 * Prev/next disc over a track's edge fade. Rendered only on mouse-only devices
 * and only on the side that still hides content, then revealed on hovering the
 * track (or tabbing into it) - a control that is always on top of the first and
 * last chip is in the way the rest of the time.
 */
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
            className={`pointer-events-none absolute top-1/2 z-1 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-it-full border border-it-border bg-it-white opacity-0 shadow-it-sm transition-opacity duration-(--it-duration-sm) ease-(--it-ease) group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 ${
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
    showCount = true,
    selectedCategories,
    selectedDate,
    guests,
    sort,
    activeFilters,
    priceMax = PRICE_MAX,
    currency,
    locale,
    attributes = {},
    sortProfile = TOURS_SORT_PROFILE,
    extraParams,
}: ToursFilterBarProps) {
    const router = useRouter();
    const pathname = usePathname();
    const { startNav } = useToursNav();

    // Grab-to-slide the control strip with a plain mouse (same affordance as the
    // tab bars); no-ops on touch and when the content fits, so it only bites
    // below md, where the four controls can outrun the viewport. The two chip
    // rows carry their own (`ScrollTrack`).
    const controlsRef = useDragScroll<HTMLDivElement>();

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
            priceMax,
            { sortProfile, extraParams }
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
                { sortProfile, extraParams }
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

    const sortOptions = sortProfile.options.map(value => ({
        value,
        label: sortDict[value],
    }));
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

    /*
     * Sort, as its own node so it can live in EITHER row.
     *
     * On a listing page it sits in the grid head beside the result counter
     * (master 3.12 draws it in the filter row; it moved down so the band above
     * is the category track's alone and the chips get the full width). On the
     * SEARCH page the counter is suppressed - the heading states the count -
     * which left Sort stranded on a row of its own, reading as a control that
     * had lost its label. There it rides the filter row instead, exactly as
     * mck-12 draws it.
     */
    const sortControl = (
                <div className='ml-auto flex shrink-0 items-center'>
                    <Popover open={sortOpen} onOpenChange={setSortOpen}>
                        <PopoverTrigger asChild>
                            <motion.button
                                type='button'
                                className='flex cursor-pointer items-center gap-[7px] whitespace-nowrap border-none bg-transparent px-1.5 py-[9px] text-[12.5px] font-medium leading-[1.6] text-it-heading tracking-[-0.012em]'>
                                <span className='font-medium text-it-text-muted tracking-[-0.012em]'>
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
                            className='w-[230px] rounded-it-md border-none bg-it-white p-2 text-it-heading shadow-it-lg duration-300 ease-(--it-ease) tracking-[-0.012em]'>
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
                                    className={`flex w-full cursor-pointer items-center justify-between rounded-it-sm border-none bg-transparent px-3 py-2.5 text-left text-[12.5px] leading-[1.6] transition-colors duration-(--it-duration-xs) hover:bg-it-bg ${
                                        opt.value === sort
                                            ? 'font-medium text-it-primary-hover tracking-[-0.012em]'
                                            : 'font-medium text-it-heading tracking-[-0.012em]'
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
    );

    const counterLabel = dict.resultsCount
        .replace('{shown}', String(shown))
        .replace('{total}', String(total));

    return (
        <>
            {/* ── Sticky toolbar (.frow + .gridhead) - the filter row AND the
                grid head ride under the navbar as ONE surface, so the applied
                filters, the count and Sort stay reachable down a long grid.
                One band, therefore one hairline, at its bottom edge.

                OPAQUE, not the frosted `--it-frow-bg` (96% white + blur) the
                shorter bars use: at 120-205px tall the 4% that shows through
                turned every card title scrolling behind it into a ghost line in
                the padding strip under the navbar, which reads as a gap. ── */}
            <div className='sticky top-16 md:top-20 z-35 mt-3.5 border-b border-it-divider bg-it-white py-3'>
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
                                className='w-auto rounded-it-lg border-none bg-it-white p-0 text-it-heading shadow-it-lg duration-300 ease-(--it-ease) tracking-[-0.012em]'>
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
                                className='w-[300px] rounded-it-lg border-none bg-it-white p-4 text-it-heading shadow-it-lg duration-300 ease-(--it-ease) tracking-[-0.012em]'>
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
                                                    <b className='block text-[13px] font-medium leading-[1.6] text-it-heading tracking-[-0.012em]'>
                                                        {t.label}
                                                    </b>
                                                    <span className='text-[13px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
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
                                                        className='grid size-[30px] cursor-pointer place-items-center rounded-full border border-it-border bg-it-white text-[14.5px] font-medium text-it-heading disabled:cursor-default disabled:opacity-30 tracking-[-0.012em]'>
                                                        −
                                                    </motion.button>
                                                    <i className='min-w-[18px] text-center text-[14px] not-italic font-medium text-it-heading tabular-nums tracking-[-0.012em]'>
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
                                                        className='grid size-[30px] cursor-pointer place-items-center rounded-full border border-it-border bg-it-white text-[14.5px] font-medium text-it-heading disabled:cursor-default disabled:opacity-30 tracking-[-0.012em]'>
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
                                        className='mt-3 w-full cursor-pointer rounded-it-sm border-none bg-it-dark py-[11px] text-[13px] font-medium text-it-white tracking-[-0.012em]'>
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
                                <span className='inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-it-full bg-it-primary px-1 text-[10.5px] font-medium leading-none text-it-white tabular-nums tracking-[-0.012em]'>
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

                    {/* With no counter below, Sort rides the filter row's right
                        edge rather than sitting alone on an otherwise empty
                        second line. */}
                    {!showCount && (
                        <div className='ml-auto flex shrink-0 items-center'>
                            {sortControl}
                        </div>
                    )}
                </div>

                {/* Grid head (.gridhead) - counter + applied chips + clear all,
                    with Sort pinned right. Sort sits HERE rather than in the
                    filter row (master 3.12 draws it in the row) so the band
                    above is the category track's alone and the chips get the
                    full width. */}
                {(showCount ||
                    chips.length > 0 ||
                    activeFilterCount > 0) && (
                    <div className='it-container flex flex-wrap items-center gap-3 gap-y-2.5 pt-3.5'>
                    {showCount && (
                        <p className='m-0 shrink-0 whitespace-nowrap text-[13px] md:text-[14.5px] leading-[1.6] text-it-heading tabular-nums tracking-[-0.012em]'>
                            {counterLabel} {dict.toursWord}
                        </p>
                    )}


                    {/* Applied chips + clear all - their own line ABOVE the
                    counter at every width (`order-first`): four pills alongside
                    the counter and Sort crowd the row and clip on the way out.
                    Same track as the categories, so a long selection scrolls
                    with the same fades and chevrons instead of clipping "Clear
                    all" off the edge. Rendered only when something is applied -
                    an empty row would still eat a `gap-y` band. */}
                    {(chips.length > 0 || activeFilterCount > 0) && (
                        <ScrollTrack
                            label='applied filters'
                            className='order-first w-full'
                            trackClassName='gap-3'>
                            {/* A plain fade, deliberately NOT `layout`: the pills
                            scroll, so a FLIP animation made a new pill fly in
                            from wherever the previous layout put it - a long
                            diagonal from below on a two-line row. */}
                            <AnimatePresence initial={false}>
                                {chips.map(chip => (
                                    <motion.button
                                        key={chip.slug}
                                        type='button'
                                        onClick={() => removeChip(chip.slug)}
                                        initial={{ opacity: 0, scale: 0.96 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.96 }}
                                        transition={swapFade}
                                        whileTap={{ scale: 0.95 }}
                                        className='inline-flex shrink-0 cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-it-full border border-it-primary/25 bg-it-primary-subtle px-[11px] py-1.5 text-[11.5px] font-medium leading-[1.2] text-it-primary-hover tracking-[-0.012em]'>
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

                            <button
                                type='button'
                                onClick={clearAll}
                                className='shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent p-0 text-[13px] md:text-[14.5px] font-medium leading-[1.6] text-it-text-muted underline underline-offset-2 tracking-[-0.012em]'>
                                {dict.clearAll}
                            </button>
                        </ScrollTrack>
                    )}
                    </div>
                )}
            </div>

            {/* Filters modal - rendered OUTSIDE the sticky band, which is its
                own stacking context; a `position: fixed` overlay nested in it
                would be positioned against the band, not the viewport. */}
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
