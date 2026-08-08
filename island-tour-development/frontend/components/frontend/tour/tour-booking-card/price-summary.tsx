'use client';

import { motion } from 'framer-motion';
import { springPop } from '@/lib/motion';
import { useBooking } from '@/hooks/tours/use-booking';
import { Collapse } from './collapse';

/**
 * The price block: breakdown + Total / Pay today / Balance later, revealed once
 * the selection is complete (`ready`).
 *
 * Its OWN block, and the last thing above the button (Pastel #58). It used to
 * live inside the travelers box, so collapsing the party left a box titled "5
 * travelers" holding a price breakdown, and it sat above the extras - so
 * anybody who added the open bar had to scroll back up to see what they now
 * owed.
 *
 * The per-band line items sit in a nested Collapse toggled by Show details /
 * Hide details; the totals are always shown while ready. No parent flex-gap
 * wraps the outer Collapse - all spacing is internal so it collapses without a
 * gap snap.
 */
export function PriceSummary() {
    const {
        dict,
        money,
        ready,
        detailsOpen,
        toggleDetails,
        priceRows,
        total,
        payToday,
        balanceLater,
        showPayToday,
        showBalance,
        balanceLabel,
    } = useBooking();

    return (
        <Collapse open={ready}>
            <div className='flex flex-col rounded-it-sm border border-it-border bg-it-white px-4 py-4'>
                <Collapse open={detailsOpen}>
                    <div className='flex flex-col gap-3.5 pb-3.5'>
                        <div className='flex flex-col gap-2'>
                            {priceRows.map(row => (
                                <div
                                    key={row.id}
                                    className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    <span>{row.text}</span>
                                    {/* A chosen band priced at zero (infants)
                                        reads as a fact, not as arithmetic about
                                        nothing. */}
                                    <span>
                                        {row.amount > 0
                                            ? money(row.amount)
                                            : dict.free}
                                    </span>
                                </div>
                            ))}
                        </div>
                        <div className='h-px w-full bg-it-heading/10' />
                    </div>
                </Collapse>
                <div className='flex flex-col gap-2'>
                    <div className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                        <span>{dict.total}</span>
                        <span>{money(total)}</span>
                    </div>
                    {/* Money rows are model-driven: pay-today and balance rows
                        each show only when non-zero (master §6.1). */}
                    {showPayToday && (
                        <div className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            <span>{dict.payToday}</span>
                            <span className='text-it-primary'>
                                {money(payToday)}
                            </span>
                        </div>
                    )}
                    {showBalance && (
                        <div className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                            <span>{balanceLabel}</span>
                            <span>{money(balanceLater)}</span>
                        </div>
                    )}
                    <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-ink-muted'>
                        {dict.taxesIncluded}
                    </span>
                </div>

                {/* The breakdown opens with a word and closes with one. It used
                    to collapse behind a bare arrow, which named neither what it
                    would do nor what was behind it (Pastel #58). */}
                <motion.button
                    type='button'
                    aria-expanded={detailsOpen}
                    onClick={() => toggleDetails()}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='flex cursor-pointer items-center justify-center self-center border-none bg-transparent pt-3.5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    <span className='underline'>
                        {detailsOpen ? dict.hideDetails : dict.showDetails}
                    </span>
                </motion.button>
            </div>
        </Collapse>
    );
}
