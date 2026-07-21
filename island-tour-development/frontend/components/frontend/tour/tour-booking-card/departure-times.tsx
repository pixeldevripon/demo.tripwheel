'use client';

import { motion, useAnimationControls, useReducedMotion } from 'framer-motion';
import { useEffect } from 'react';
import { useBooking } from '@/hooks/tours/use-booking';
import {
    shakeTransition,
    shakeX,
    springPop,
    swapFade,
} from '@/lib/motion';
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
        ctaErrorNonce,
    } = useBooking();

    // The CTA was clicked without a time: tint the selectable chips and give
    // the row a quick shake so the eye lands on what the note above the
    // button is asking for (no wrapper box - it collided with the date field).
    const missingSlot = ctaError === 'slot';

    const reduceMotion = useReducedMotion();
    const controls = useAnimationControls();

    // Exactly when the chip grid is in the tree: `Collapse` unmounts its
    // children (AnimatePresence) and the skeleton swaps in for the grid while
    // slots load, so the element comes and goes.
    const slotsVisible =
        selectedDate != null && !slotsLoading && slots.length > 0;

    // The row's own fade-in. It lives here rather than in an `animate` prop
    // because the element is bound to `controls`, and a bound component takes
    // its target only from them - which also means the start must wait for the
    // element to exist. Firing it on mount alone would leave the grid stuck at
    // `initial` opacity 0 whenever slots were still loading at that point,
    // since controls with no subscriber animate nothing.
    useEffect(() => {
        if (!slotsVisible) return;
        controls.start({ opacity: 1, transition: swapFade });
    }, [controls, slotsVisible]);

    // Replay the shake on EVERY blocked Checkout press, not just the first.
    // `ctaErrorNonce` is the dependency that makes that possible: `missingSlot`
    // is already true by the second press, so an effect (or a declarative
    // target) keyed on it alone would never fire again. Imperative `.start` for
    // the same reason - re-rendering the same keyframes is not a state change.
    useEffect(() => {
        if (!missingSlot || reduceMotion || !slotsVisible) return;
        controls.start({ x: shakeX, transition: shakeTransition });
    }, [missingSlot, ctaErrorNonce, reduceMotion, slotsVisible, controls]);

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
                    animate={controls}
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
