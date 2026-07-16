'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { toDateParam } from '@/lib/checkout/checkout';
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
    // calendar renders in a body portal, positioned under the date field and
    // re-measured on scroll/resize so it tracks the field as the sticky rail or
    // the inner scroll moves.
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [mounted, setMounted] = useState(false);
    const [coords, setCoords] = useState<PopoverCoords | null>(null);
    useEffect(() => setMounted(true), []);
    useEffect(() => {
        if (!calendarOpen) return;
        const update = () => {
            const el = triggerRef.current;
            if (!el) return;
            const r = el.getBoundingClientRect();
            setCoords({ top: r.bottom + 8, left: r.left, width: r.width });
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
            .filter((k) => calendarDays[k].available)
            .sort();
        return open[0] ?? null;
    }, [isLive, calendarDays]);

    // Auto-advance the month view to the first available month (only before the
    // traveller has picked a date), so a tour whose next departure is months out
    // does not open on an all-disabled month.
    useEffect(() => {
        if (!firstAvailable || selectedDate) return;
        const [y, m] = firstAvailable.split('-').map(Number);
        setView((v) =>
            v.year === y && v.month === m - 1 ? v : { year: y, month: m - 1 },
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
        setView((v) => {
            const d = new Date(v.year, v.month + delta, 1);
            return { year: d.getFullYear(), month: d.getMonth() };
        });

    return (
        <div className='relative'>
            <motion.button
                ref={triggerRef}
                type='button'
                onClick={() => toggleCalendar()}
                aria-expanded={calendarOpen}
                transition={springPop}
                className='flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-[8px] bg-it-white px-4 py-4 text-left'>
                <span
                    className={`text-[16px] leading-[1.6] tracking-[-0.012em] ${
                        selectedDate
                            ? 'text-it-heading'
                            : 'text-it-ink-placeholder'
                    }`}>
                    {selectedDate
                        ? formatSelectedDate(selectedDate, locale)
                        : dict.selectDate}
                </span>
                <Image
                    src='/icons/booking-calendar.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-6 shrink-0'
                />
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
                                className='fixed z-[90] rounded-[16px] bg-it-white p-4 shadow-it-lg'>
                                {/* Month nav: ← current | year | next → */}
                                <div className='flex items-center justify-between gap-2 pb-4'>
                                    <motion.button
                                        type='button'
                                        onClick={() => shiftMonth(-1)}
                                        whileTap={{ scale: 0.99 }}
                                        transition={springPop}
                                        className='flex cursor-pointer items-center gap-2 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        <Image
                                            src='/icons/booking-arrow.svg'
                                            alt=''
                                            width={20}
                                            height={20}
                                            className='size-5 shrink-0 rotate-180'
                                        />
                                        {monthName(
                                            view.month,
                                            view.year,
                                            locale,
                                        )}
                                    </motion.button>
                                    <span className='font-medium text-[20px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                        {view.year}
                                    </span>
                                    <motion.button
                                        type='button'
                                        onClick={() => shiftMonth(1)}
                                        whileTap={{ scale: 0.99 }}
                                        transition={springPop}
                                        className='flex cursor-pointer items-center gap-2 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                        {monthName(
                                            view.month === 11
                                                ? 0
                                                : view.month + 1,
                                            view.month === 11
                                                ? view.year + 1
                                                : view.year,
                                            locale,
                                        )}
                                        <Image
                                            src='/icons/booking-arrow.svg'
                                            alt=''
                                            width={20}
                                            height={20}
                                            className='size-5 shrink-0'
                                        />
                                    </motion.button>
                                </div>

                                {/* Weekday headers + day cells (pulse while the live
                            calendar is still loading). */}
                                <div
                                    aria-busy={isLive && calendarLoading}
                                    className={`grid grid-cols-7 gap-y-2 text-center ${
                                        isLive &&
                                        calendarLoading &&
                                        !calendarDays
                                            ? 'animate-pulse'
                                            : ''
                                    }`}>
                                    {weekdays.map((w) => (
                                        <span
                                            key={w}
                                            className='font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            {w}
                                        </span>
                                    ))}
                                    {/* Day cells */}
                                    {calendarCells.map(({ date, inMonth }) => {
                                        const key = date.toISOString();
                                        const isPast =
                                            date.getTime() < today.getTime();
                                        // Live mode: only days the backend reports as
                                        // available are selectable (absent = no
                                        // departures, present-but-unavailable = sold
                                        // out / closed). Demo mode: every future day is
                                        // open.
                                        const dayState = isLive
                                            ? calendarDays?.[toDateParam(date)]
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
                                                    selectedDate,
                                                ).getTime();
                                        // Hover hint: why a future in-month day can't be
                                        // picked (live only). Absent day = no schedule,
                                        // sold-out / closed = an exception or full slots.
                                        let hint: string | null = null;
                                        if (
                                            isLive &&
                                            inMonth &&
                                            !isPast &&
                                            !dayOpen
                                        ) {
                                            hint = !dayState
                                                ? dict.calendarNoDepartures
                                                : dayState.status === 'SOLD_OUT'
                                                  ? dict.soldOut
                                                  : dict.calendarClosed;
                                        }
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
                                                                  null,
                                                              )
                                                        : undefined
                                                }>
                                                <motion.button
                                                    type='button'
                                                    disabled={disabled}
                                                    title={hint ?? undefined}
                                                    onClick={() =>
                                                        pickDate(date)
                                                    }
                                                    whileTap={
                                                        disabled
                                                            ? undefined
                                                            : { scale: 0.9 }
                                                    }
                                                    transition={springPop}
                                                    className={`grid size-9 place-items-center rounded-it-full text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors duration-300 ${
                                                        isSelected
                                                            ? 'bg-it-primary font-medium text-it-white'
                                                            : disabled
                                                              ? 'cursor-not-allowed text-it-ink-muted/50'
                                                              : 'cursor-pointer text-it-heading hover:bg-it-surface'
                                                    }`}>
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
                                                                    className='block origin-bottom whitespace-nowrap rounded-[6px] bg-it-heading px-2 py-1 text-[12px] leading-[1.4] tracking-[-0.012em] text-it-white shadow-it-md'>
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
                    document.body,
                )}
        </div>
    );
}
