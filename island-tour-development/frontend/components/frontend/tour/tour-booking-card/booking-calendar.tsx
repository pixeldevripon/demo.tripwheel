'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { springPop } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import {
    COLLAPSE_EASE,
    DAY_MS,
    formatSelectedDate,
    mondayIndex,
    monthName,
    startOfDay,
    weekdayLabels,
} from './lib/booking.utils';

/**
 * The date field and its full-month calendar popover. The popover's own concerns
 * - which month is on screen (`view`) and the past-date floor (`today`) - are
 * local state here; the picked date is committed to the shared flow via
 * `pickDate`, and `calendarOpen` lives in the flow so the CTA can open it too.
 */
export function BookingCalendar() {
    const {
        dict,
        locale,
        selectedDate,
        calendarOpen,
        toggleCalendar,
        pickDate,
    } = useBooking();

    // `today` is only read once the calendar opens (post-mount) so it never
    // reaches the server-rendered HTML - no hydration mismatch.
    const [today] = useState(() => startOfDay(new Date()));
    const [view, setView] = useState(() => {
        const d = startOfDay(new Date());
        return { year: d.getFullYear(), month: d.getMonth() };
    });

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

    return (
        <div className='relative'>
            <motion.button
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

            <AnimatePresence>
                {calendarOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2, ease: COLLAPSE_EASE }}
                        className='absolute top-full left-0 z-50 mt-2 w-full rounded-[16px] bg-it-white p-4 shadow-it-lg'>
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
                                {monthName(view.month, view.year, locale)}
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
                                    view.month === 11 ? 0 : view.month + 1,
                                    view.month === 11
                                        ? view.year + 1
                                        : view.year,
                                    locale
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

                        {/* Weekday headers */}
                        <div className='grid grid-cols-7 gap-y-2 text-center'>
                            {weekdays.map(w => (
                                <span
                                    key={w}
                                    className='font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {w}
                                </span>
                            ))}
                            {/* Day cells */}
                            {calendarCells.map(({ date, inMonth }) => {
                                const isPast = date.getTime() < today.getTime();
                                const disabled = !inMonth || isPast;
                                const isSelected =
                                    selectedDate != null &&
                                    startOfDay(date).getTime() ===
                                        startOfDay(selectedDate).getTime();
                                return (
                                    <motion.button
                                        key={date.toISOString()}
                                        type='button'
                                        disabled={disabled}
                                        onClick={() => pickDate(date)}
                                        whileTap={
                                            disabled
                                                ? undefined
                                                : { scale: 0.9 }
                                        }
                                        transition={springPop}
                                        className={`mx-auto grid size-9 place-items-center rounded-it-full text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors duration-300 ${
                                            isSelected
                                                ? 'bg-it-primary font-medium text-it-white'
                                                : disabled
                                                  ? 'cursor-not-allowed text-it-ink-muted/50'
                                                  : 'cursor-pointer text-it-heading hover:bg-it-surface'
                                        }`}>
                                        {date.getDate()}
                                    </motion.button>
                                );
                            })}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

