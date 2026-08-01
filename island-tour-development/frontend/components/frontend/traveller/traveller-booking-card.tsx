'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { useState } from 'react';

import type { TravellerBooking } from '@/lib/api/public/traveller';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { crossFade } from '@/lib/motion';

import { TravellerBookingPanel } from './traveller-booking-panel';
import {
    bookingTone,
    paymentTone,
    TravellerChip,
    TravellerPayChip,
} from './traveller-chip';
import { formatDay, lookupLabel, money, partyLabel } from './traveller-format';
import { isCancelledFamily } from './traveller-groups';

/**
 * One booking card (review 5.4). ONE expand affordance: the whole header row
 * is the toggle (F12), aria-expanded wired, with a quiet "Open booking page"
 * link inside the shared panel.
 */
export function TravellerBookingCard({
    booking,
    dict,
    typDict,
    locale,
    nowMs,
    whatsappHref,
    variant = 'full',
    defaultOpen = false,
}: {
    booking: TravellerBooking;
    /** Shared row labels (Date & time, Total, Ref, ...) from the thank-you page. */
    dict: Dictionary['traveller'];
    typDict: Dictionary['thankYou'];
    locale: Locale;
    /** Server-stamped request instant, for the free-cancellation window copy. */
    nowMs: number;
    /** Dashboard-managed WhatsApp deep link; null hides the support fallback. */
    whatsappHref: string | null;
    /** `compact` = past/cancelled rows: smaller thumb, muted when cancelled. */
    variant?: 'full' | 'compact';
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);

    const cancelled = isCancelledFamily(booking.displayStatus);
    const past = !cancelled && variant === 'compact';
    const active = !cancelled && !past;

    // "Completed" is DERIVED (review 5.6): a departed trip whose status was
    // never flipped to REDEEMED must not keep reading "Confirmed".
    const chipStatus =
        past && booking.displayStatus === 'CONFIRMED'
            ? 'REDEEMED'
            : booking.displayStatus;
    const statusLabel = lookupLabel(dict.bookingStatus, chipStatus);

    const dateLine = [formatDay(booking.localDate, locale), booking.startTime]
        .filter(Boolean)
        .join(' · ');
    const metaLine = [
        dateLine,
        booking.partySize > 0 ? partyLabel(booking.partySize, dict) : null,
        booking.destinationName,
    ]
        .filter(Boolean)
        .join(' · ');

    return (
        <article
            className={`overflow-hidden rounded-[16px] border border-it-heading/10 bg-it-white ${
                cancelled ? 'opacity-75' : ''
            }`}>
            <button
                type='button'
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                className='flex w-full cursor-pointer items-center gap-4 border-none bg-transparent p-5 text-left sm:p-6'>
                {booking.tourImageUrl && (
                    <span
                        className={`relative hidden shrink-0 overflow-hidden rounded-[12px] bg-it-border sm:block ${
                            variant === 'full'
                                ? 'h-[72px] w-[96px]'
                                : 'h-[56px] w-[76px]'
                        }`}>
                        <Image
                            src={booking.tourImageUrl}
                            alt=''
                            fill
                            sizes='96px'
                            className='object-cover'
                        />
                    </span>
                )}
                <span className='min-w-0 flex-1'>
                    <strong
                        className={`block font-normal leading-[1.4] tracking-[-0.012em] text-it-heading ${
                            variant === 'full' ? 'text-[19px]' : 'text-[17px]'
                        }`}>
                        {booking.tourName}
                    </strong>
                    <span className='mt-1 block text-[14.5px] leading-[1.6] text-it-text-muted'>
                        {metaLine}
                    </span>
                    <span className='mt-2 flex flex-wrap items-center gap-1.5'>
                        <TravellerChip
                            label={statusLabel}
                            tone={bookingTone(chipStatus)}
                        />
                        {paymentChipFor(booking, dict)}
                    </span>
                </span>
                <span className='hidden shrink-0 text-right sm:block'>
                    <span className='block font-normal text-[19px] leading-[1.3] tracking-[-0.012em] text-it-heading'>
                        {money(booking.totalRetail, booking.currency, locale)}
                    </span>
                    <span className='mt-0.5 block font-mono text-[12.5px] text-it-text-muted'>
                        {booking.displayRef}
                    </span>
                </span>
                <motion.span
                    aria-hidden
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={crossFade}
                    className='inline-flex shrink-0 text-it-text-muted'>
                    <ChevronDown className='size-5' strokeWidth={2} />
                </motion.span>
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key='details'
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={crossFade}
                        className='overflow-hidden'>
                        <TravellerBookingPanel
                            booking={booking}
                            dict={dict}
                            typDict={typDict}
                            locale={locale}
                            nowMs={nowMs}
                            whatsappHref={whatsappHref}
                            active={active}
                            past={past}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </article>
    );
}

/** DIT-7 payment chip for the header row, model- and state-aware. */
export function paymentChipFor(
    booking: TravellerBooking,
    dict: Dictionary['traveller'],
    /** Append the paid amount to the label (next-trip hero: "Deposit paid $600"). */
    amountSuffix?: string
): ReactNode {
    if (booking.paymentModel === 'OPERATOR_FULL') {
        return (
            <TravellerPayChip label={dict.payNoPaymentTaken} settled={false} />
        );
    }
    if (booking.refundStatus === 'REFUNDED') {
        return (
            <TravellerPayChip
                label={dict.paymentState.REFUNDED}
                settled={false}
            />
        );
    }
    const label = lookupLabel(dict.paymentState, booking.paymentStatus);
    return (
        <TravellerPayChip
            label={amountSuffix ? `${label} ${amountSuffix}` : label}
            settled={paymentTone(booking.paymentStatus) === 'positive'}
        />
    );
}

