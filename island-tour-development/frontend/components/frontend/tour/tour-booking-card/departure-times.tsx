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
 * Departure-time chips, revealed once a date is picked - on a tour with MORE
 * THAN ONE departure. A tour with a single departure shows no row at all: there
 * is nothing to pick, and a lone chip reading "Selected" is a control that
 * cannot be operated (Pastel #58). The store selects that departure instead.
 *
 * An open chip shows the time and nothing else. The small line underneath is for
 * capacity only - "Sold out", never "Available" and never "Selected", both of
 * which said what the chip's own styling already says. Selection IS the orange
 * border and fill.
 *
 * "Only N left" is deliberately absent from v1: the founder parked both
 * scarcity signals (the chip sub-text and the date subscript) on 2026-08-07,
 * because an honest one needs live per-departure capacity.
 *
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

    // The picker only belongs on a tour with a choice to make. One departure
    // (the common case) renders nothing - the store has already picked it.
    const hasChoice = slots.length > 1;

    return (
        <Collapse
            open={
                selectedDate != null &&
                (slotsLoading || hasChoice || noDepartures)
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
                    className=''>
                    <p className='m-0 text-[13px] font-medium leading-[1.5]'>
                        {dict.noDeparturesOnDateTitle.replace(
                            '{date}',
                            formatSelectedDate(selectedDate!, locale)
                        )}
                    </p>
                    <p className='m-0 mt-0.5 text-[12px] leading-[1.5] text-it-text-muted tracking-[-0.012em]'>
                        {dict.noDeparturesOnDateHint}
                    </p>
                </motion.div>
            ) : slotsLoading ? (
                <motion.div
                    key='loading'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={swapFade}
                    className='flex flex-wrap gap-2'>
                    {[0, 1, 2].map(i => (
                        <div
                            key={i}
                            // Same box as a real time chip (8+8 padding, the
                            // 13.5px time, the reserved 11px capacity line and
                            // the border), so resolving slots never jolts the
                            // card.
                            className='h-[62px] w-[84px] it-skeleton rounded-[8px]'
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
                    // 2px of room under the chips, inside the collapse that
                    // clips them. `springPop` is underdamped, so releasing a tap
                    // overshoots past scale 1 and the chip's bottom border was
                    // being sliced against a box that hugged it exactly. The
                    // space belongs here rather than in <Collapse>: lifting the
                    // clip there needed a re-render on animation-complete, and
                    // that made every panel shake as it opened.
                    className='pb-0.5'>
                    {/* `.slotlabel` (mck-15): 12px bold in the muted grey. */}
                    <span className='mb-2 block text-[12px] font-medium leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        {dict.departureTime}
                    </span>
                    {/* `.slotrow`: chips WRAP, they do not share a fixed grid.
                        A three-column grid stretched two departures across the
                        card and cut a long localized time in half; the chip is
                        as wide as its own label and the row runs on. */}
                    <div className='flex flex-wrap gap-2'>
                    {slots.map(slot => {
                        const isSelected = selectedTime === slot.time;
                        const soldOut = slot.status === 'sold_out';
                        // Capacity only. An open chip says the time and nothing
                        // else; the orange border and fill say which one is
                        // chosen, so a "Selected" line under it was the chip
                        // narrating itself.
                        const note = soldOut ? dict.soldOut : null;
                        // Missing-slot error: pickable chips carry a soft
                        // primary border (a quieter cousin of the selected
                        // state) that clears the moment a time is picked.
                        // Default chips carry the subtle hairline so they
                        // read as pickable boxes on the white card (.slot);
                        // the selected chip swaps to the orange tint (.slot.on).
                        // Border AND fill in ONE branch, with the white on the
                        // unselected side rather than in the base class. Both
                        // are background-color utilities, and Tailwind settles
                        // a conflict by CSS source order, not by the order they
                        // appear in the attribute - so a base `bg-it-white`ns
                        // silently beat the selected tint and the chip showed
                        // an orange border on a white fill. The spec is "the
                        // orange border and fill".
                        const chipSkin = isSelected
                            ? 'border-it-primary bg-it-primary-subtle'
                            : missingSlot && !soldOut
                              ? 'border-it-primary/45 bg-it-white'
                              : 'border-it-border bg-it-white';
                        return (
                            <motion.button
                                key={slot.time}
                                type='button'
                                disabled={soldOut}
                                // Selection is the orange border and fill, and
                                // colour is not a signal on its own. `aria-
                                // pressed` says the same thing to a screen
                                // reader without putting the word "Selected"
                                // under the time, which the client's spec
                                // reserves for capacity.
                                aria-pressed={isSelected}
                                onClick={() => selectTime(slot.time)}
                                whileTap={soldOut ? undefined : { scale: 0.97 }}
                                transition={springPop}
                                // `.slot` (mck-15): 8/14 padding, 10px radius,
                                // 13.5px bold tabular, centred. Selection is
                                // the orange border and tint; a sold-out chip
                                // simply fades to half.
                                className={`rounded-[8px] border px-4 py-2 text-center transition-colors duration-200 ${chipSkin} ${
                                    soldOut
                                        ? 'cursor-not-allowed opacity-50'
                                        : 'cursor-pointer'
                                }`}>
                                <span
                                    className={`block whitespace-nowrap text-[14.5px] font-medium leading-[1.4] tabular-nums ${
                                        isSelected
                                            ? 'text-it-primary-hover tracking-[-0.012em]'
                                            : ''
                                    }`}>
                                    {formatTime(slot.time, locale)}
                                </span>
                                {/* The capacity line's space is RESERVED, not
                                    conditional. `.slotrow` is a flex row, so in
                                    the mockup one sold-out chip stretches every
                                    sibling to its two-line height - which is the
                                    height the chips are drawn at. Rendering the
                                    line only when there is a note made the row
                                    short on a tour with nothing sold out, and
                                    would have made it jump taller the moment a
                                    departure filled. 11px at 1.25 = 13.75px,
                                    the exact line this holds open. */}
                                <span className='block min-h-[13.75px] text-[13px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                                    {note}
                                </span>
                            </motion.button>
                        );
                    })}
                    </div>
                </motion.div>
            )}
        </Collapse>
    );
}

