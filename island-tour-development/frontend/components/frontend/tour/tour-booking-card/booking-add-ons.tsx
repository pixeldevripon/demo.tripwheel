'use client';

import { useBooking } from '@/hooks/tours/use-booking';
import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';
import { Collapse } from './collapse';
import { Stepper } from './stepper';

/**
 * Optional extras (master E.3 `add_ons[]`: "Optional extras at the booking
 * step").
 *
 * In the card from the first render and CLOSED - the same treatment the brief
 * gives the spectators field (§3.6: in step 1, never expanded by default, never
 * framed as an upsell). It also means only one block appears later instead of
 * two, so the button moves less. The header names the section outright rather
 * than asking permission to show it: a row reading "Show extras" is a question
 * the chevron already asks.
 *
 * Nothing is ever pre-selected (master ethical CRO: "no pre-checked add-ons"):
 * every quantity starts at 0. The stepper counts UNITS, and the unit is
 * whatever the price line says - one step on a "per person" extra is one
 * person, capped at the paying travellers; a "per booking" extra caps at one,
 * because it cannot be bought twice (Pastel #58). Renders nothing when the tour
 * has no add-ons - the common case.
 */
export function BookingAddOns() {
    const { dict, data, addOnQty, setAddOnQty, addOnMax, money } = useBooking();
    const [open, setOpen] = useState(false);

    if (data.addOns.length === 0) return null;

    return (
        // `.extras` (mck-15): a rule above and 12px of air, NOT a bordered card.
        // The card already has one border; a second box inside it turned every
        // section into its own panel and buried the order the client asked for.
        <div className='mt-3 border-t border-it-divider pt-3'>
            {/* `.exhead`: 14px bold, the whole row is the click target. */}
            <motion.button
                type='button'
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
                whileTap={{ scale: 0.99 }}
                transition={springPop}
                className='flex w-full cursor-pointer items-center justify-between gap-2.5 border-none bg-transparent text-left'>
                <span className='text-[14px] font-bold leading-[1.4] text-it-ink'>
                    {dict.addOnsTitle}
                </span>
                <Image
                    src='/icons/booking-chevron-down.svg'
                    alt=''
                    width={20}
                    height={20}
                    className={`size-[17px] shrink-0 transition-transform duration-300 ${
                        open ? 'rotate-180' : ''
                    }`}
                />
            </motion.button>

            <Collapse open={open}>
                <div>
                    {data.addOns.map(addOn => {
                        const qty = addOnQty[addOn.id] ?? 0;
                        // "$22 per person", not "$22/per person".
                        const priceSuffix =
                            addOn.unit === 'PER_PERSON'
                                ? dict.perPerson
                                : dict.perBooking;
                        return (
                            // `.exrow`: top-aligned, hairline between rows and
                            // none after the last.
                            <div
                                key={addOn.id}
                                className='flex items-start gap-3 border-b border-it-divider py-2.5 last:border-b-0'>
                                <div className='flex min-w-0 flex-col'>
                                    <span className='text-[13.5px] font-bold leading-[1.4] text-it-ink'>
                                        {addOn.name}
                                    </span>
                                    {addOn.description && (
                                        <span className='text-[12px] leading-[1.4] text-it-text-muted'>
                                            {addOn.description}
                                        </span>
                                    )}
                                    <span className='text-[12px] leading-[1.4] text-it-ink-muted'>
                                        {`${money(addOn.price)} ${priceSuffix}`}
                                    </span>
                                </div>
                                <Stepper
                                    value={qty}
                                    min={0}
                                    max={addOnMax(addOn)}
                                    decLabel={`− ${addOn.name}`}
                                    incLabel={`+ ${addOn.name}`}
                                    onChange={n => setAddOnQty(addOn.id, n)}
                                />
                            </div>
                        );
                    })}
                </div>
            </Collapse>
        </div>
    );
}
