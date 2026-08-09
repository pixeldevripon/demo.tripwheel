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
            {/* `.wsummary` (mck-15): a rule above, 12px of air, and 13.5px rows
                that sit at 3px each. Not a bordered card - the totals are the
                card's own last word, not another panel inside it. */}
            <div className='mt-3 flex flex-col border-t border-it-divider pt-3 text-[13.5px] leading-[1.4]'>
                <Collapse open={detailsOpen}>
                    <div>
                        {priceRows.map(row => (
                            <div
                                key={row.id}
                                className='flex items-center justify-between gap-2 py-[3px] tabular-nums'>
                                <span className='text-it-text-muted'>
                                    {row.text}
                                </span>
                                {/* A chosen band priced at zero (infants)
                                    reads as a fact, not as arithmetic about
                                    nothing. */}
                                <span className='font-semibold text-it-ink'>
                                    {row.amount > 0
                                        ? money(row.amount)
                                        : dict.free}
                                </span>
                            </div>
                        ))}
                        {/* `.bkdiv` - the hairline that separates what was
                            chosen from what it comes to. */}
                        <div className='my-2 h-px w-full bg-it-divider' />
                    </div>
                </Collapse>
                <div className='flex items-center justify-between gap-2 py-[3px] tabular-nums'>
                    <span className='text-it-text-muted'>{dict.total}</span>
                    <b className='text-[16px] font-extrabold text-it-ink'>
                        {money(total)}
                    </b>
                </div>
                {/* Money rows are model-driven: pay-today and balance rows
                    each show only when non-zero (master §6.1). */}
                {showPayToday && (
                    <div className='flex items-center justify-between gap-2 py-[3px] tabular-nums'>
                        <span className='text-it-text-muted'>
                            {dict.payToday}
                        </span>
                        {/* `.pay` - the one figure the traveller is charged
                            now, and the only one carrying the brand colour. */}
                        <b className='font-bold text-it-primary-hover'>
                            {money(payToday)}
                        </b>
                    </div>
                )}
                {showBalance && (
                    <div className='flex items-center justify-between gap-2 py-[3px] tabular-nums'>
                        <span className='text-it-text-muted'>
                            {balanceLabel}
                        </span>
                        <b className='font-semibold text-it-ink'>
                            {money(balanceLater)}
                        </b>
                    </div>
                )}
                <span className='mt-1 text-[12px] leading-[1.4] text-it-ink-muted'>
                    {dict.taxesIncluded}
                </span>

                {/* The breakdown opens with a word and closes with one. It used
                    to collapse behind a bare arrow, which named neither what it
                    would do nor what was behind it (Pastel #58). Left-aligned
                    under the rows it belongs to, not centred adrift of them. */}
                <motion.button
                    type='button'
                    aria-expanded={detailsOpen}
                    onClick={() => toggleDetails()}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='mt-1.5 cursor-pointer self-start border-none bg-transparent text-[12.5px] font-bold leading-[1.4] text-it-primary-hover underline underline-offset-2'>
                    {detailsOpen ? dict.hideDetails : dict.showDetails}
                </motion.button>
            </div>
        </Collapse>
    );
}
