'use client';

import { format } from 'date-fns';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { forwardRef, type ReactNode } from 'react';

import { Calendar } from '@/components/ui/calendar';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { springPop } from '@/lib/motion';

/**
 * Where the pill is sitting. It is ONE bar in three positions, not three bars -
 * only the chrome around it changes.
 *
 * - `hero`   over the destination/home hero photo: centred, capped at 660px,
 *            heavy shadow so it lifts off the image.
 * - `docked` mobile only, fixed under the nav once the hero has scrolled past
 *            (Pastel #51's "E behaviour"): full bleed inside a 12px gutter,
 *            lighter shadow, no cap.
 * - `layer`  inside the mobile full-screen search layer (Pastel #57): on white,
 *            so the shadow becomes a hairline border - a drop shadow on a white
 *            sheet reads as a rendering artefact.
 */
export type SearchPillVariant = 'hero' | 'docked' | 'layer';

export type SearchPillDict = {
    /** Desktop placeholder for the activity field - the full question. */
    searchPlaceholder: string;
    /** Mobile placeholder for the same field. */
    searchPlaceholderShort: string;
    /**
     * Accessible name for the field, when it differs from the visible
     * placeholder - the navbar blanks the placeholder so its rotating category
     * overlay can show through, and a nameless search field is not an option.
     */
    ariaLabel?: string;
    /**
     * Date-field copy. Optional because a pill can have no date half at all -
     * the navbar search and the homepage hero both search without one, and
     * making them carry labels for a field they never render is how unused
     * strings end up in seven dictionaries.
     */
    selectDate?: string;
    selectDateShort?: string;
    clearDate?: string;
    /** Accessible name of the round submit button. */
    searchLabel: string;
};

const SHELL: Record<SearchPillVariant, string> = {
    // 6px 6px 6px 12px on desktop, 4px 4px 4px 10px on mobile (handoff §1/§4).
    hero: 'mx-auto w-full max-w-[660px] rounded-it-full bg-it-white p-1.5 pl-3 shadow-[0_18px_44px_rgba(0,0,0,0.3)] max-md:p-1 max-md:pl-2.5',
    docked:
        'w-full rounded-it-full bg-it-white p-1 pl-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.18)]',
    layer: 'w-full gap-1.5! rounded-it-full border border-it-border bg-it-white p-1 pl-2.5 shadow-[0_1px_2px_rgba(31,41,55,0.05)]',
};

/**
 * The one-pill search bar (Pastel #51, handoff S4h): activity field, hairline
 * divider, date field and a round orange search button, all in a single row.
 *
 * IT REPLACED A WHITE PANEL, and that is the whole point of the issue. The old
 * bar was a ~400px stacked card on mobile that covered the hero photo - "our
 * emotional sell" - with two borderless fields that read as loose grey text
 * rather than as inputs. One 56px row gives the photo the fold back.
 *
 * ONE COMPONENT FOR EVERY POSITION. The hero pill, the mobile docked pill and
 * the pill inside the full-screen layer are the same bar; letting them be three
 * components is how the docked one quietly stops matching the hero it came from.
 *
 * `onOpenLayer` is what makes the mobile flow work: rather than focusing the
 * input in place - which opens the keyboard over an inline panel, the exact
 * complaint in Pastel #57 - a transparent button covers the pill on mobile and
 * hands off to the layer, which mounts this same pill at the top of a full
 * screen. Omit it (inside the layer, and on desktop) and the pill behaves
 * natively.
 */
export const SearchPill = forwardRef<HTMLInputElement, {
    variant?: SearchPillVariant;
    dict: SearchPillDict;
    /** Short placeholders + a 48px button; the caller decides from the viewport. */
    compact?: boolean;
    query: string;
    onQueryChange: (value: string) => void;
    onFocus?: () => void;
    /** Omit the date half entirely - the homepage hero searches islands, not days. */
    showDate?: boolean;
    date?: Date;
    onDateChange?: (date: Date | undefined) => void;
    /** Controlled calendar popover. Inside the layer the calendar is inline instead. */
    dateOpen?: boolean;
    onDateOpenChange?: (open: boolean) => void;
    /** Render the date field as a plain button (the layer opens its own calendar). */
    inlineCalendar?: boolean;
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
    /**
     * Mobile: hand the bar to the full-screen layer instead of acting in place.
     * Told WHICH HALF was tapped, because that is the view the layer must open
     * on - tapping "When?" and landing on a focused text field with the
     * keyboard up is the wrong answer to the question the visitor just asked.
     */
    onOpenLayer?: (target: 'query' | 'date') => void;
    /**
     * Leading icon in the activity field. Defaults to the magnifier; the
     * homepage hero passes its location pin, because that field searches
     * ISLANDS and a magnifier there would be a worse label than the pin.
     */
    icon?: string;
    /** Rotating placeholder overlay etc., rendered inside the activity field. */
    children?: ReactNode;
}>(function SearchPill(
    {
        variant = 'hero',
        dict,
        compact = false,
        query,
        onQueryChange,
        onFocus,
        showDate = true,
        date,
        onDateChange,
        dateOpen,
        onDateOpenChange,
        inlineCalendar = false,
        onSubmit,
        onOpenLayer,
        icon = '/icons/search-soft.svg',
        children,
    },
    inputRef
) {
    /*
     * Hand-off is MOBILE ONLY, and `compact` is how the caller tells us that -
     * the component cannot see the viewport itself, and desktop must keep the
     * inline dropdown and the date popover exactly as they are.
     */
    const handOff = compact && onOpenLayer ? onOpenLayer : null;

    const placeholder = compact
        ? dict.searchPlaceholderShort
        : dict.searchPlaceholder;
    const datePlaceholder =
        (compact ? dict.selectDateShort : dict.selectDate) ?? '';

    const dateButton = (
        <motion.button
            type='button'
            aria-label={dict.selectDate}
            transition={springPop}
            onClick={
                handOff
                    ? () => handOff('date')
                    : inlineCalendar
                      ? () => onDateOpenChange?.(true)
                      : undefined
            }
            className={`flex min-w-0 flex-1 cursor-pointer items-center gap-2 whitespace-nowrap rounded-it-full border-none bg-transparent py-2.5 pl-2.5 pr-1 text-left leading-[1.6] transition-colors hover:bg-it-bg ${
                compact ? 'text-[15px] tracking-[-0.012em]' : 'text-[15.5px] tracking-[-0.012em]'
            } ${date ? 'font-medium text-it-heading tracking-[-0.012em]' : 'font-medium text-it-text-muted tracking-[-0.012em]'}`}>
            <Image
                src='/icons/calendar-soft.svg'
                alt=''
                width={24}
                height={24}
                className='size-4.5 shrink-0'
            />
            <span className='whitespace-nowrap'>
                {date ? format(date, 'd MMM') : datePlaceholder}
            </span>
        </motion.button>
    );

    return (
        <form
            onSubmit={onSubmit}
            role='search'
            className={`relative flex items-center gap-2 text-left transition-shadow focus-within:ring-2 focus-within:ring-it-primary-hover max-md:gap-1 ${SHELL[variant]}`}>
            {/* Activity field. 16px below md is load-bearing: iOS Safari
                force-zooms the whole viewport when a focused input computes
                under 16px and never zooms back out (Pastel #29 was filed
                against this exact field). */}
            <label
                className={`flex min-w-0 flex-[3_1_0%] cursor-text items-center gap-2 rounded-it-full px-1 transition-colors hover:bg-it-bg ${
                    variant === 'layer' ? 'py-1.5' : 'py-2.5'
                }`}>
                <Image
                    src={icon}
                    alt=''
                    width={24}
                    height={24}
                    className='size-4.5 shrink-0'
                />
                <span className='relative min-w-0 flex-1'>
                    <input
                        ref={inputRef}
                        type='search'
                        value={query}
                        onChange={e => onQueryChange(e.target.value)}
                        onFocus={onFocus}
                        // `readOnly`, not `disabled`: the field stays focusable
                        // and readable by assistive tech, but no keyboard opens
                        // against a panel that is about to be replaced.
                        readOnly={!!handOff}
                        onClick={handOff ? () => handOff('query') : undefined}
                        placeholder={placeholder}
                        // The aria-label stays the FULL question at every width -
                        // "What?" is a visual abbreviation, not a name.
                        aria-label={dict.ariaLabel ?? dict.searchPlaceholder}
                        className='min-w-0 w-full border-none bg-transparent text-[16px] font-medium leading-[1.6] text-it-heading outline-none placeholder:font-medium placeholder:text-it-text-muted md:text-[15.5px] [&::-webkit-search-cancel-button]:appearance-none tracking-[-0.012em]'
                    />
                    {children}
                </span>
            </label>

            {showDate && (
                <>
                    {/* The divider is what makes ONE ROW read as TWO FIELDS
                        rather than one long input - the handoff kept it visible
                        on mobile for exactly that reason (§4: the old
                        `display:none` is gone).

                        A fixed 24px on `bg-it-border`, not `my-1.5` on
                        `bg-it-divider`: the margin form derived its height from
                        the bar, so it shrank with the bar on mobile and in the
                        layer, and the lighter token then disappeared into the
                        white at the size that was left. */}
                    <span
                        aria-hidden='true'
                        className='h-6 w-px shrink-0 self-center bg-it-border'
                    />

                    {/* 40% of the row, against the query field's 60%.
                        Two earlier attempts were both wrong: the handoff's flat
                        100px assumed no clear button, so "21 Aug ✕" truncated
                        to "21 …" - a date field that could not show the date it
                        held - and sizing it to its content instead left the
                        placeholder crowded against the divider. A share of the
                        row is stable whatever it holds. */}
                    <div className='flex min-w-0 flex-[2_1_0%] items-center gap-1 rounded-it-full'>
                        {/* No popover when the layer is going to take over:
                            a calendar popover would open behind it. */}
                        {inlineCalendar || handOff ? (
                            dateButton
                        ) : (
                            <Popover
                                open={dateOpen}
                                onOpenChange={onDateOpenChange}>
                                <PopoverTrigger asChild>
                                    {dateButton}
                                </PopoverTrigger>
                                <PopoverContent
                                    align='start'
                                    sideOffset={20}
                                    className='w-auto rounded-[8px] bg-it-white p-0 text-it-heading duration-300 ease-[cubic-bezier(0.21,0.47,0.32,0.98)] tracking-[-0.012em]'>
                                    <Calendar
                                        mode='single'
                                        selected={date}
                                        onSelect={selected => {
                                            onDateChange?.(selected);
                                            onDateOpenChange?.(false);
                                        }}
                                        disabled={{ before: new Date() }}
                                        autoFocus
                                        className='bg-it-white [--cell-radius:8px]'
                                    />
                                </PopoverContent>
                            </Popover>
                        )}

                        {/* Clear is a SIBLING of the trigger: a button's
                            descendants are presentational to the accessibility
                            tree, so a nested control would be unreachable. */}
                        {date && (
                            <motion.button
                                type='button'
                                aria-label={dict.clearDate}
                                whileTap={{ scale: 0.9 }}
                                transition={springPop}
                                onClick={() => onDateChange?.(undefined)}
                                className='grid shrink-0 cursor-pointer place-items-center border-none bg-transparent p-0'>
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
                </>
            )}

            {/* The labelled Search button became an icon circle (handoff §3).
                White on #E8611A computes 3.41:1, over the WCAG 3:1 floor for
                non-text contrast, so dropping the word costs nothing. */}
            <motion.button
                type='submit'
                aria-label={dict.searchLabel}
                whileTap={{ scale: 0.95 }}
                transition={springPop}
                className={`flex shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-it-primary p-0 transition-colors hover:bg-it-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary-hover ${
                    variant === 'layer'
                        ? 'size-8'
                        : compact
                          ? 'size-12'
                          : 'size-[50px]'
                }`}>
                <Image
                    src='/icons/hero-search-white.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-5'
                />
            </motion.button>

            {/* An earlier draft covered the whole bar with ONE transparent
                button. It opened the layer from anywhere, which sounds right
                and was not: tapping "When?" opened the layer on the text field
                with the keyboard up, having thrown away the fact that the
                visitor asked for the date. Each half now opens its own view. */}
        </form>
    );
});
