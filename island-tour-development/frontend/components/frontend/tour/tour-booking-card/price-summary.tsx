'use client';

import { motion } from 'framer-motion';
import { springPop } from '@/lib/motion';
import Image from 'next/image';
import { useBooking } from '@/hooks/tours/use-booking';
import { Collapse } from './collapse';

/**
 * Price breakdown + totals, revealed once the availability check passes
 * (`ready`). The per-band line items sit in their own nested Collapse toggled by
 * the "Show details" link; the Total / Pay today / Balance later block is always
 * shown while ready. No parent flex-gap wraps the outer Collapse - all spacing is
 * internal so it collapses without a gap snap.
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
            <div className='flex flex-col px-4 pb-4'>
                <div className='h-px w-full bg-it-heading/10' />
                <Collapse open={detailsOpen}>
                    <div className='flex flex-col gap-3.5 pt-3.5'>
                        <div className='flex flex-col gap-2'>
                            {priceRows.map(row => (
                                <div
                                    key={row.id}
                                    className='flex items-center justify-between gap-1 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    <span>{row.text}</span>
                                    <span>{money(row.amount)}</span>
                                </div>
                            ))}
                        </div>
                        <div className='h-px w-full bg-it-heading/10' />
                    </div>
                </Collapse>
                <div className='flex flex-col gap-2 pt-3.5'>
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

                <motion.button
                    type='button'
                    aria-label={dict.showDetails}
                    aria-expanded={detailsOpen}
                    onClick={() => toggleDetails()}
                    whileTap={{ scale: 0.97 }}
                    transition={springPop}
                    className='flex cursor-pointer items-center justify-center self-center border-none bg-transparent pt-3.5 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    {detailsOpen ? (
                        <Image
                            src='/icons/booking-chevron-down.svg'
                            alt=''
                            width={20}
                            height={20}
                            className='size-5 shrink-0 rotate-180'
                        />
                    ) : (
                        <span className='underline'>{dict.showDetails}</span>
                    )}
                </motion.button>
            </div>
        </Collapse>
    );
}
