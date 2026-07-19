'use client';

import { motion } from 'framer-motion';
import { useBooking } from '@/hooks/tours/use-booking';
import { springPop, swapFade } from '@/lib/motion';
import { Collapse } from './collapse';
import { formatTime } from './lib/booking.utils';

/**
 * Departure-time chips, revealed once a date is picked. Each chip shows the
 * localized start time plus a state note (selected / sold out / "Only N left").
 * In live mode the slots are the date's real bookable departures (loaded async,
 * so a skeleton shows while they resolve); in demo mode they are the tour's
 * static start times.
 */
export function DepartureTimes() {
    const {
        dict,
        locale,
        slots,
        slotsLoading,
        selectedDate,
        selectedTime,
        selectTime,
        ctaError,
    } = useBooking();

    // The CTA was clicked without a time: tint the selectable chips and give
    // the row a quick shake so the eye lands on what the note above the
    // button is asking for (no wrapper box - it collided with the date field).
    const missingSlot = ctaError === 'slot';

    return (
        <Collapse
            open={selectedDate != null && (slotsLoading || slots.length > 0)}>
            {/* pt-2 = the stack gap, kept INSIDE the collapse so it animates
                with the height tween (an outer flex gap would snap in). */}
            {slotsLoading ? (
                <motion.div
                    key='loading'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={swapFade}
                    className='grid grid-cols-3 gap-2 pt-2'>
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            // Same height as a real time chip (py-2 + time +
                            // note lines + border), so resolving slots never
                            // jolts the card.
                            className='h-[74px] animate-pulse rounded-[8px] bg-it-border'
                        />
                    ))}
                </motion.div>
            ) : (
                <motion.div
                    key='slots'
                    initial={{ opacity: 0 }}
                    // A one-shot horizontal shake when the missing-slot error
                    // fires; opacity keeps its own fade-in transition.
                    animate={
                        missingSlot
                            ? { opacity: 1, x: [0, -5, 5, -3, 3, 0] }
                            : { opacity: 1, x: 0 }
                    }
                    transition={{
                        default: swapFade,
                        x: { duration: 0.35, ease: 'easeInOut' },
                    }}
                    className='grid grid-cols-3 gap-2 pt-2'>
                    {slots.map(slot => {
                        const isSelected = selectedTime === slot.time;
                        const soldOut = slot.status === 'sold_out';
                        // Every chip carries a status line: selected, sold out,
                        // "Only N left" when scarce (< 5), else a plain
                        // "Available" default.
                        const note = isSelected
                            ? dict.selected
                            : soldOut
                              ? dict.soldOut
                              : slot.remaining != null
                                ? dict.onlyLeft.replace(
                                      '{count}',
                                      String(slot.remaining)
                                  )
                                : dict.available;
                        // Missing-slot error: pickable chips carry a soft
                        // primary border (a quieter cousin of the selected
                        // state) that clears the moment a time is picked.
                        const chipBorder = isSelected
                            ? 'border-it-primary'
                            : missingSlot && !soldOut
                              ? 'border-it-primary/45'
                              : 'border-transparent';
                        return (
                            <motion.button
                                key={slot.time}
                                type='button'
                                disabled={soldOut}
                                onClick={() => selectTime(slot.time)}
                                whileTap={soldOut ? undefined : { scale: 0.97 }}
                                transition={springPop}
                                className={`flex flex-col items-center gap-[3px] rounded-[8px] border bg-it-white px-4 py-2 transition-colors duration-300 ${chipBorder} ${
                                    soldOut
                                        ? 'cursor-not-allowed opacity-60'
                                        : 'cursor-pointer'
                                }`}>
                                <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {formatTime(slot.time, locale)}
                                </span>
                                {note && (
                                    <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                        {note}
                                    </span>
                                )}
                            </motion.button>
                        );
                    })}
                </motion.div>
            )}
        </Collapse>
    );
}
