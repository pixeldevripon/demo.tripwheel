'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { toDateParam } from '@/lib/checkout/checkout';
import {
    calendarDayLabel,
    calendarDayReason,
    isStruckThrough,
} from '@/lib/tours/calendar-day-state';
import { crossFade, springPop } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    COLLAPSE_EASE,
    DAY_MS,
    formatSelectedDate,
    mondayIndex,
    monthName,
    startOfDay,
    weekdayLabels,
} from './lib/booking.utils';

/** Fixed-position box for the portalled popover (viewport coords, from the field). */
interface PopoverCoords {
    top: number;
    left: number;
    width: number;
}

/**
 * The date field and its full-month calendar popover. The popover's own concerns
 * - which month is on screen (`view`) and the past-date floor (`today`) - are
 * local state here; the picked date is committed to the shared flow via
 * `pickDate`, and `calendarOpen` lives in the flow so the CTA can open it too.
 *
 * The card's selector stack scrolls inside an `overflow` container, which would
 * clip an in-flow absolute popover - so the calendar is rendered in a body portal
 * and positioned (fixed) under the date field, re-measured on scroll/resize so it
 * tracks the field as the sticky rail or inner scroll moves.
 */
export function BookingCalendar() {
    const {
        dict,
        locale,
        selectedDate,
        calendarOpen,
        toggleCalendar,
        pickDate,
        isLive,
        calendarDays,
        calendarLoading,
        ctaError,
    } = useBooking();

    // `today` is only read once the calendar opens (post-mount) so it never
    // reaches the server-rendered HTML - no hydration mismatch.
    const [today] = useState(() => startOfDay(new Date()));
    // Which disabled day is hovered, so its "why" hint tooltip shows.
    const [hoveredKey, setHoveredKey] = useState<string | null>(null);
    const [view, setView] = useState(() => {
        const d = startOfDay(new Date());
        return { year: d.getFullYear(), month: d.getMonth() };
    });

    // Portal + fixed positioning: the card's selector stack scrolls inside an
    // `overflow` container that would clip an in-flow absolute popover, so the
    // calendar renders in a body portal, positioned OVER the field stack and
    // re-measured on scroll/resize so it tracks it as the sticky rail or the
    // inner scroll moves.
    //
    // Over, not under (mck-15 `#ical{position:absolute;top:0;left:0;right:0}`):
    // the calendar takes the fields' place while it is open rather than pushing
    // the card taller, so the button below it does not move. The portal stays -
    // the mockup is a static page with no scroll container to be clipped by,
    // and a fixed layer is the only version of `top:0 of the field stack` that
    // survives one.
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState<PopoverCoords | null>(null);
    useEffect(() => setMounted(true), []);
    useEffect(() => {
        if (!calendarOpen) return;
        const update = () => {
            const el = triggerRef.current;
            if (!el) return;
            // The `.wfields` stack this field sits in - the box the overlay
            // covers. Falls back to the field itself if the structure changes.
            const box = (el.closest('[data-booking-fields]') ?? el)
                .getBoundingClientRect();
            setCoords({ top: box.top, left: box.left, width: box.width });
        };
        update();
        // Capture phase catches scrolls from the inner card body too, not just
        // the window, so the popover stays glued to the field.
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => {
            window.removeEventListener('scroll', update, true);
            window.removeEventListener('resize', update);
        };
    }, [calendarOpen]);

    // First day with availability (yyyy-MM-dd), once the live calendar resolves.
    const firstAvailable = useMemo(() => {
        if (!isLive || !calendarDays) return null;
        const open = Object.keys(calendarDays)
            .filter(k => calendarDays[k].available)
            .sort();
        return open[0] ?? null;
    }, [isLive, calendarDays]);

    // Auto-advance the month view to the first available month (only before the
    // traveller has picked a date), so a tour whose next departure is months out
    // does not open on an all-disabled month.
    useEffect(() => {
        if (!firstAvailable || selectedDate) return;
        const [y, m] = firstAvailable.split('-').map(Number);
        setView(v =>
            v.year === y && v.month === m - 1 ? v : { year: y, month: m - 1 }
        );
    }, [firstAvailable, selectedDate]);

    // ── Calendar grid (Monday-first, prev/next month spill greyed + disabled). ──
    const weekdays = useMemo(() => weekdayLabels(locale), [locale]);
    const calendarCells = useMemo(() => {
        const first = new Date(view.year, view.month, 1);
        const lead = mondayIndex(first.getDay());
        const daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
        const cells: { date: Date; inMonth: boolean }[] = [];
        for (let i = 0; i < lead; i++) {
            cells.push({
                date: new Date(view.year, view.month, 1 - (lead - i)),
                inMonth: false,
            });
        }
        for (let d = 1; d <= daysInMonth; d++) {
            cells.push({
                date: new Date(view.year, view.month, d),
                inMonth: true,
            });
        }
        while (cells.length % 7 !== 0) {
            const last = cells[cells.length - 1].date;
            cells.push({
                date: new Date(last.getTime() + DAY_MS),
                inMonth: false,
            });
        }
        return cells;
    }, [view]);

    const shiftMonth = (delta: number) =>
        setView(v => {
            const d = new Date(v.year, v.month + delta, 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });

    // Each nav button is named for the month it lands on - the chevrons carry no
    // text of their own, and "July 2026" says more than "previous".
    const monthLabelAt = (delta: number) => {
        const d = new Date(view.year, view.month + delta, 1);
        return `${monthName(d.getMonth(), d.getFullYear(), locale)} ${d.getFullYear()}`;
    };
    const prevMonthLabel = monthLabelAt(-1);
    const nextMonthLabel = monthLabelAt(1);

    return (
        <div className='relative'>
            <motion.button
                ref={triggerRef}
                type='button'
                onClick={() => toggleCalendar()}
                aria-expanded={calendarOpen}
                aria-invalid={ctaError === 'date' || undefined}
                // What the mobile sticky bar focuses after scrolling the card
                // back into view: the first thing still to answer.
                data-booking-date-trigger=''
                transition={springPop}
                // `.wfield` (mck-15): 1px border, 10px radius, 11/13 padding,
                // 14px semibold, icon LEFT at 17px. Blocked CTA click with no
                // date: ring the field so the note above the button points
                // somewhere concrete.
                className={`flex w-full cursor-pointer items-center gap-2.5 rounded-it-sm border border-it-border bg-it-white px-[13px] py-[11px] text-left ${
                    ctaError === 'date' ? 'ring-1 ring-it-primary' : ''
                }`}>
                <Image
                    src='/icons/booking-calendar.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-[17px] shrink-0'
                    // Card chrome, always visible above the fold - it must not
                    // queue behind the page's ~190 lazy images. `eager` (not
                    // `priority`) loads it immediately WITHOUT adding a
                    // preload link that would compete with the gallery LCP.
                    loading='eager'
                />
                <span
                    className={`text-[14px] font-semibold leading-[1.6] ${
                        selectedDate ? 'text-it-ink' : 'text-it-ink-muted'
                    }`}>
                    {selectedDate
                        ? formatSelectedDate(selectedDate, locale)
                        : dict.selectDate}
                </span>
                {/* "Change" once a date is set - the field stops looking like an
                    empty input and starts looking like an answer you can edit
                    (mck-15 `.wfield .chg`). Nothing to change before then. */}
                {selectedDate && (
                    <span className='ml-auto text-[12px] font-medium leading-[1.6] text-it-primary-hover underline underline-offset-2'>
                        {dict.change}
                    </span>
                )}
            </motion.button>

            {mounted &&
                createPortal(
                    <AnimatePresence>
                        {calendarOpen && coords && (
                            <motion.div
                                initial={{ opacity: 0, y: -8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -8 }}
                                transition={{
                                    duration: 0.2,
                                    ease: COLLAPSE_EASE,
                                }}
                                style={{
                                    top: coords.top,
                                    left: coords.left,
                                    width: coords.width,
                                }}
                                // 10px, the fields'radius - not the mockup's
                                // own 16px (`.wcal`). Every box inside this
                                // card now speaks one radius: the fields, the
                                // travelers panel and this. At 16px the corner
                                // sat visibly wider than the field it covers,
                                // and the tight layer of the e3 shadow traced a
                                // second arc just inside it. Ripon's call,
                                // 2026-08-09.
                                className='fixed z-[90] rounded-[16px] border border-it-border bg-it-white p-4 shadow-it-lg'>
                                {/* Month nav: a chevron on each end, the month
                                    and its year CENTRED between them.
                                    mck-15 puts the next month's name on the
                                    right, but the client's actual instruction
                                    was about the year - "move the year next to
                                    the month on the left, so it reads August
                                    2026 instead of the year floating between
                                    two month names". Centred keeps that and
                                    drops the second month name, which was the
                                    part doing the floating.

                                    Each button's accessible name is the month it
                                    goes TO, so a screen reader hears "July 2026,
                                    button"rather than a bare"previous" - and
                                    it needs no new copy in seven locales. */}
                                <div className='mb-3 flex items-center justify-between gap-2'>
                                    <motion.button
                                        type='button'
                                        onClick={() => shiftMonth(-1)}
                                        aria-label={prevMonthLabel}
                                        whileTap={{ scale: 0.94 }}
                                        transition={springPop}
                                        className='grid size-7 shrink-0 cursor-pointer place-items-center rounded-it-full border border-it-border bg-it-white transition-colors duration-200 hover:bg-it-bg'>
                                        <Image
                                            src='/icons/booking-chevron-down.svg'
                                            alt=''
                                            width={20}
                                            height={20}
                                            className='size-3.5 shrink-0 rotate-90'
                                        />
                                    </motion.button>
                                    <span
                                        aria-live='polite'
                                        className='text-[14.5px] font-medium leading-[1.6] text-it-ink'>
                                        {`${monthName(
                                            view.month,
                                            view.year,
                                            locale
                                        )} ${view.year}`}
                                    </span>
                                    <motion.button
                                        type='button'
                                        onClick={() => shiftMonth(1)}
                                        aria-label={nextMonthLabel}
                                        whileTap={{ scale: 0.94 }}
                                        transition={springPop}
                                        className='grid size-7 shrink-0 cursor-pointer place-items-center rounded-it-full border border-it-border bg-it-white transition-colors duration-200 hover:bg-it-bg'>
                                        <Image
                                            src='/icons/booking-chevron-down.svg'
                                            alt=''
                                            width={20}
                                            height={20}
                                            className='size-3.5 shrink-0 -rotate-90'
                                        />
                                    </motion.button>
                                </div>

                                {/* `.grid` + `.dow` (mck-15): 7 columns at a 3px
                                    gap, weekday heads 10px bold uppercase in
                                    faint. Pulses while the live calendar loads. */}
                                <div
                                    aria-busy={isLive && calendarLoading}
                                    className={`grid grid-cols-7 gap-[3px] text-center ${
                                        isLive &&
                                        calendarLoading &&
                                        !calendarDays
                                            ? 'animate-pulse'
                                            : ''
                                    }`}>
                                    {weekdays.map(w => (
                                        <span
                                            key={w}
                                            className='py-1 text-[10px] font-medium uppercase leading-[1.6] tracking-[0.06em] text-it-ink-muted'>
                                            {w}
                                        </span>
                                    ))}
                                    {/* Day cells */}
                                    {calendarCells.map(({ date, inMonth }) => {
                                        const dateKey = toDateParam(date);
                                        const key = date.toISOString();
                                        const isPast =
                                            date.getTime() < today.getTime();
                                        // Live mode: only days the backend reports as
                                        // available are selectable (absent = no
                                        // departures, present-but-unavailable = sold
                                        // out / closed). Demo mode: every future day is
                                        // open.
                                        const dayState = isLive
                                            ? calendarDays?.[dateKey]
                                            : undefined;
                                        const dayOpen =
                                            !isLive ||
                                            dayState?.available === true;
                                        const disabled =
                                            !inMonth || isPast || !dayOpen;
                                        const isSelected =
                                            selectedDate != null &&
                                            startOfDay(date).getTime() ===
                                                startOfDay(
                                                    selectedDate
                                                ).getTime();
                                        // Why a future in-month day can't be picked
                                        // (live only), as three distinct states rather
                                        // than one grey "Closed" for all of them.
                                        const showState =
                                            isLive && inMonth && !isPast && !dayOpen;
                                        const reason = showState
                                            ? calendarDayReason(dayState)
                                            : 'open';
                                        const hint = showState
                                            ? calendarDayLabel(reason, dict)
                                            : null;
                                        // The line means "there WAS a departure and it
                                        // can no longer be had" - so it covers sold out
                                        // and past-cutoff, and not a day the tour never
                                        // runs. On a phone, where hover does not exist,
                                        // this is the whole signal.
                                        const struck = isStruckThrough(reason);
                                        // Today gets a ring; the first bookable date
                                        // gets an orange outline while nothing is
                                        // chosen, so the calendar opens pointing at the
                                        // soonest answer instead of at nothing.
                                        const isToday =
                                            inMonth &&
                                            date.getTime() === today.getTime();
                                        const isFirstOpen =
                                            !isSelected &&
                                            selectedDate == null &&
                                            firstAvailable === dateKey;
                                        return (
                                            <div
                                                key={key}
                                                className='relative flex justify-center'
                                                onMouseEnter={
                                                    hint
                                                        ? () =>
                                                              setHoveredKey(key)
                                                        : undefined
                                                }
                                                onMouseLeave={
                                                    hint
                                                        ? () =>
                                                              setHoveredKey(
                                                                  null
                                                              )
                                                        : undefined
                                                }>
                                                <motion.button
                                                    type='button'
                                                    disabled={disabled}
                                                    // NO `title`. It handed the
                                                    // browser a tooltip of its
                                                    // own, drawn BELOW the cell
                                                    // while the styled bubble
                                                    // sat above it - the same
                                                    // two words twice, in two
                                                    // designs, on every hovered
                                                    // date (Pastel #79). The
                                                    // bubble is the one the
                                                    // mockup draws and the one
                                                    // we control, so it is the
                                                    // one that stays. Nothing
                                                    // went with the `title`:
                                                    // the hint reaches
                                                    // assistive tech through
                                                    // the label below, which a
                                                    // `title` on a DISABLED
                                                    // button never did reliably
                                                    // anyway.
                                                    //
                                                    // The label is the whole
                                                    // answer for a screen
                                                    // reader, which cannot see
                                                    // the line either.
                                                    aria-label={
                                                        hint
                                                            ? `${date.getDate()}, ${hint}`
                                                            : isToday
                                                              ? `${date.getDate()}, ${dict.calendarToday}`
                                                              : undefined
                                                    }
                                                    onClick={() =>
                                                        pickDate(date)
                                                    }
                                                    whileTap={
                                                        disabled
                                                            ? undefined
                                                            : { scale: 0.9 }
                                                    }
                                                    transition={springPop}
                                                    className={[
                                                        // `.d` (mck-15): 8px
                                                        // radius, 12.5px
                                                        // semibold tabular.
                                                        //
                                                        // SQUARE, and centred in
                                                        // its column. The mockup
                                                        // lets the cell fill the
                                                        // column, which makes it
                                                        // 44 wide by 34 tall -
                                                        // so `border-radius:50%`
                                                        // on today drew a flat
                                                        // grey ellipse rather
                                                        // than a ring. A square
                                                        // cell gives today a
                                                        // true circle and keeps
                                                        // the selected day a
                                                        // rounded square, which
                                                        // is what tells the two
                                                        // states apart at a
                                                        // glance.
                                                        'mx-auto grid aspect-square w-full max-w-[34px] place-items-center rounded-[8px] border text-[12.5px] leading-[1.6] tabular-nums transition-colors duration-200',
                                                        struck && 'line-through',
                                                        isToday && 'rounded-full',
                                                        // The ring on today
                                                        // survives the day being
                                                        // unbookable - it says
                                                        // WHERE you are, not
                                                        // whether you can book.
                                                        isSelected || isFirstOpen
                                                            ? 'border-it-primary'
                                                            : isToday
                                                              ? 'border-it-ink-muted'
                                                              : 'border-transparent',
                                                        // ONE branch owns the
                                                        // fill, the weight and
                                                        // the text colour. Split
                                                        // across a base class
                                                        // and a branch, the two
                                                        // font-weight utilities
                                                        // would be resolved by
                                                        // CSS source order
                                                        // rather than by which
                                                        // one is written last -
                                                        // the same trap that
                                                        // stopped the selected
                                                        // chip getting its fill.
                                                        isSelected
                                                            ? 'bg-it-primary font-medium text-it-white'
                                                            : disabled
                                                              ? 'cursor-not-allowed font-medium text-it-ink-muted'
                                                              : isFirstOpen
                                                                ? 'cursor-pointer bg-it-bg font-medium text-it-primary-hover'
                                                                : isToday
                                                                  ? // Today, and
                                                                    // bookable:
                                                                    // the ring
                                                                    // plus a
                                                                    // heavier
                                                                    // number, so
                                                                    // "you are
                                                                    // here" is
                                                                    // legible
                                                                    // even at
                                                                    // 12.5px.
                                                                    'cursor-pointer font-medium text-it-ink hover:bg-it-bg'
                                                                  : 'cursor-pointer font-semibold text-it-ink hover:bg-it-bg',
                                                    ]
                                                        .filter(Boolean)
                                                        .join(' ')}>
                                                    {date.getDate()}
                                                </motion.button>
                                                <AnimatePresence>
                                                    {hint &&
                                                        hoveredKey === key && (
                                                            <div className='pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2'>
                                                                <motion.span
                                                                    role='tooltip'
                                                                    initial={{
                                                                        opacity: 0,
                                                                        y: 4,
                                                                        scale: 0.96,
                                                                    }}
                                                                    animate={{
                                                                        opacity: 1,
                                                                        y: 0,
                                                                        scale: 1,
                                                                    }}
                                                                    exit={{
                                                                        opacity: 0,
                                                                        y: 4,
                                                                        scale: 0.96,
                                                                    }}
                                                                    transition={
                                                                        crossFade
                                                                    }
                                                                    // `.tip`
                                                                    // (mck-15):
                                                                    // 10.5px
                                                                    // bold on
                                                                    // the dark
                                                                    // ink, with
                                                                    // the little
                                                                    // arrow
                                                                    // pointing
                                                                    // at its own
                                                                    // date.
                                                                    className='relative block origin-bottom whitespace-nowrap rounded-[6px] bg-it-dark px-2 py-[3px] text-[10.5px] font-bold leading-[1.6] text-it-white after:absolute after:left-1/2 after:top-full after:-ml-1 after:border-x-4 after:border-t-4 after:border-x-transparent after:border-t-it-dark after:content-[""]'>
                                                                    {hint}
                                                                </motion.span>
                                                            </div>
                                                        )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>

                            </motion.div>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
        </div>
    );
}

