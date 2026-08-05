'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { shakeTransition, shakeX, springPop, swapFade } from '@/lib/motion';
import {
    animate,
    motion,
    useMotionValue,
    useReducedMotion,
} from 'framer-motion';
import { useEffect } from 'react';
import { Collapse } from './collapse';
import { formatSelectedDate, formatTime } from './lib/booking.utils';

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

    // The shake rides its own motion value rather than the element's `animate`
    // prop. That keeps the two concerns apart: `animate` stays declarative and
    // owns only the fade-in, `shakeOffset` owns only x. Binding `animate` to
    // AnimationControls instead would hand the whole target over to them - the
    // fade would then have to be fired imperatively too, and any moment the
    // grid was unmounted (Collapse closes it, the skeleton replaces it while
    // slots load) the controls would have no subscriber, the start would go
    // nowhere, and the grid would mount at `initial` opacity 0 and stay
    // invisible. A motion value has no such coupling: it lives on this
    // component, survives the grid coming and going, and animating it while
    // nothing is bound is simply a no-op.
    const shakeOffset = useMotionValue(0);

    // Replay the shake on EVERY blocked Checkout press, not just the first.
    // `ctaErrorNonce` is the dependency that makes that possible: `missingSlot`
    // is already true by the second press, so an effect (or a declarative
    // target) keyed on it alone would never fire again - re-rendering the same
    // keyframes is not a state change, and framer has nothing to react to.
    useEffect(() => {
        if (!missingSlot || reduceMotion) return;
        animate(shakeOffset, shakeX, shakeTransition);
    }, [missingSlot, ctaErrorNonce, reduceMotion, shakeOffset]);

    /*
     * A chosen day with nothing running used to collapse to NOTHING - the date
     * sat in the field looking accepted while the times simply never appeared.
     * That is worst for a traveller arriving from a search for a specific day,
     * who has every reason to believe the date was honoured. Say it instead.
     */
    const noDepartures =
        selectedDate != null && !slotsLoading && slots.length === 0;

    return (
        <Collapse
            open={
                selectedDate != null &&
                (slotsLoading || slots.length > 0 || noDepartures)
            }>
            {/* pt-2 / pb-2 = the stack gaps, kept INSIDE the collapse so they
                animate with the height tween (an outer sibling margin would
                snap in). The bottom one rides on top of the selector stack's
                own 8px, so the chips get real air between them and the party
                panel instead of the two blocks reading as one. */}
            {noDepartures ? (
                <motion.div
                    key='no-departures'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={swapFade}
                    className='pb-2 pt-2'>
                    <p className='m-0 text-[14px] font-semibold leading-[1.5] text-it-ink'>
                        {dict.noDeparturesOnDateTitle.replace(
                            '{date}',
                            formatSelectedDate(selectedDate!, locale)
                        )}
                    </p>
                    <p className='m-0 mt-0.5 text-[13px] leading-[1.5] text-it-ink-muted'>
                        {dict.noDeparturesOnDateHint}
                    </p>
                </motion.div>
            ) : slotsLoading ? (
                <motion.div
                    key='loading'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={swapFade}
                    className='grid grid-cols-3 gap-2 pb-2 pt-2'>
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            // Same height as a real time chip (py-2 + time +
                            // note lines + border), so resolving slots never
                            // jolts the card.
                            className='h-[74px] it-skeleton rounded-it-sm'
                        />
                    ))}
                </motion.div>
            ) : (
                <motion.div
                    key='slots'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={swapFade}
                    style={{ x: shakeOffset }}
                    className='grid grid-cols-3 gap-2 pb-2 pt-2'>
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
                        // Default chips carry the subtle hairline so they
                        // read as pickable boxes on the white card (.slot);
                        // the selected chip swaps to the orange tint (.slot.on).
                        const chipBorder = isSelected
                            ? 'border-it-primary bg-it-primary-subtle'
                            : missingSlot && !soldOut
                              ? 'border-it-primary/45'
                              : 'border-it-border';
                        return (
                            <motion.button
                                key={slot.time}
                                type='button'
                                disabled={soldOut}
                                onClick={() => selectTime(slot.time)}
                                whileTap={soldOut ? undefined : { scale: 0.97 }}
                                transition={springPop}
                                // `px-2`, not `px-4`: the chip is a grid item,
                                // so the cell decides its width and the padding
                                // only decides how early the label wraps. At
                                // px-4 the 3 columns lost enough room to the
                                // scroll region's scrollbar to break "12:00 PM"
                                // across two lines. Nothing moves visually -
                                // the label is centred in the same box.
                                className={`flex flex-col items-center gap-[3px] rounded-it-sm border bg-it-white px-2 py-2 transition-colors duration-300 ${chipBorder} ${
                                    soldOut
                                        ? 'cursor-not-allowed opacity-60'
                                        : 'cursor-pointer'
                                }`}>
                                <span
                                    className={`whitespace-nowrap text-[14px] font-bold leading-[1.6] tabular-nums ${
                                        isSelected
                                            ? 'text-it-primary-hover'
                                            : 'text-it-ink'
                                    }`}>
                                    {formatTime(slot.time, locale)}
                                </span>
                                {note && (
                                    <span className='text-[12px] leading-[1.5] text-it-text-muted'>
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

