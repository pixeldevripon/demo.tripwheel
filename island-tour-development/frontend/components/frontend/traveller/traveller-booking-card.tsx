'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { ReactNode } from 'react';

import { localizeHref, type Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { TravellerBooking } from '@/lib/api/public/traveller';
import { crossFade } from '@/lib/motion';

import { TravellerCancelPanel } from './traveller-cancel-panel';
import { bookingTone, paymentTone, TravellerChip } from './traveller-chip';
import { formatDay, isPositive, lookupLabel, money } from './traveller-format';

/**
 * One booking, in the same visual language as the thank-you page: a calm white
 * card that answers "which trip, when, what state" at a glance, expanding into
 * the TOUR DETAILS / PAYMENT pair the traveller already knows from their
 * confirmation. Row labels are borrowed from the `thankYou` dictionary rather
 * than duplicated, so the two surfaces cannot drift apart in seven locales.
 */
export function TravellerBookingCard({
    booking,
    dict,
    typDict,
    locale,
    nowMs,
}: {
    booking: TravellerBooking;
    dict: Dictionary['traveller'];
    /** Shared row labels (Date & time, Duration, Total, Ref, ...). */
    typDict: Dictionary['thankYou'];
    locale: Locale;
    /** Server-stamped request instant, for the free-cancellation window copy. */
    nowMs: number;
}) {
    const [open, setOpen] = useState(false);

    const statusLabel = lookupLabel(dict.bookingStatus, booking.displayStatus);
    const paymentLabel = lookupLabel(dict.paymentState, booking.paymentStatus);
    const paymentNote = dict.paymentModelNote[booking.paymentModel] ?? null;

    const dateLine = [formatDay(booking.localDate, locale), booking.startTime]
        .filter(Boolean)
        .join('  ·  ');

    // The manage view is the thank-you page, which is locale-less by design
    // (the proxy rewrites it) and keyed on the unguessable publicRef.
    const manageHref = booking.destinationSlug
        ? `/${booking.destinationSlug}/thank-you/${booking.publicRef}`
        : null;

    return (
        <div className='overflow-hidden rounded-[16px] border border-it-heading/10 bg-it-white'>
            <div className='flex flex-col gap-5 p-5 sm:p-6'>
                <div className='flex flex-wrap items-start justify-between gap-x-4 gap-y-3'>
                    <div className='min-w-0 flex-1'>
                        <div className='mb-2 flex flex-wrap items-center gap-1.5'>
                            <TravellerChip
                                label={statusLabel}
                                tone={bookingTone(booking.displayStatus)}
                            />
                            <TravellerChip
                                label={paymentLabel}
                                tone={paymentTone(booking.paymentStatus)}
                            />
                        </div>
                        <strong className='block font-medium text-[20px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                            {booking.tourName}
                        </strong>
                        <span className='mt-1 block text-[15px] leading-[1.6] text-it-text-muted'>
                            {dateLine}
                            {booking.partySize > 0 && (
                                <>
                                    {'  ·  '}
                                    {dict.guests.replace(
                                        '{count}',
                                        String(booking.partySize)
                                    )}
                                </>
                            )}
                        </span>
                    </div>
                    <div className='shrink-0 text-right'>
                        <span className='block font-medium text-[22px] leading-[1.3] tracking-[-0.012em] text-it-heading'>
                            {money(booking.totalRetail, booking.currency, locale)}
                        </span>
                        <span className='mt-0.5 block font-mono text-[13px] text-it-text-muted'>
                            {booking.displayRef}
                        </span>
                    </div>
                </div>

                <div className='flex flex-wrap items-center gap-2.5'>
                    {manageHref && (
                        <Link
                            href={manageHref}
                            className='rounded-full bg-it-primary px-4.5 py-2.25 text-[14px] font-semibold text-it-primary-fg no-underline transition-[filter] hover:brightness-95'>
                            {dict.manageBooking}
                        </Link>
                    )}
                    {booking.review.canReview && booking.review.reviewToken && (
                        <Link
                            href={localizeHref(
                                locale,
                                `/review/${booking.review.reviewToken}`
                            )}
                            className='rounded-full border-[1.5px] border-it-heading/20 px-4.5 py-2.25 text-[14px] font-semibold text-it-heading no-underline transition-colors hover:border-it-heading/40'>
                            {dict.reviewCta}
                        </Link>
                    )}
                    <motion.button
                        type='button'
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setOpen(v => !v)}
                        aria-expanded={open}
                        className='ml-auto inline-flex items-center gap-1.5 text-[14px] font-semibold text-it-primary transition-opacity hover:opacity-80'>
                        {open ? dict.hideDetails : dict.showDetails}
                        <motion.span
                            animate={{ rotate: open ? 180 : 0 }}
                            transition={crossFade}
                            className='inline-flex'>
                            <ChevronDown className='size-4' strokeWidth={2} />
                        </motion.span>
                    </motion.button>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key='details'
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={crossFade}
                        className='overflow-hidden'>
                        <div className='border-t border-it-heading/10 bg-it-surface p-5 sm:p-6'>
                            <div className='grid gap-4 lg:grid-cols-2'>
                                <Panel title={typDict.tourDetails}>
                                    <DetailRow
                                        icon='/icons/thank-you/detail-calendar.svg'
                                        label={typDict.dateTime}>
                                        {dateLine}
                                    </DetailRow>
                                    <DetailRow
                                        icon='/icons/thank-you/detail-travelers.svg'
                                        label={typDict.traveler}>
                                        {dict.guests.replace(
                                            '{count}',
                                            String(booking.partySize)
                                        )}
                                    </DetailRow>
                                    <DetailRow
                                        icon='/icons/thank-you/detail-trip.svg'
                                        label={typDict.trip}>
                                        {booking.tourName}
                                    </DetailRow>
                                    <DetailRow
                                        icon='/icons/thank-you/detail-clock.svg'
                                        label={dict.rowBooked}>
                                        {formatDay(booking.createdAt, locale)}
                                    </DetailRow>
                                </Panel>

                                <Panel title={typDict.paymentTitle}>
                                    <MoneyRow
                                        label={typDict.total}
                                        value={money(
                                            booking.totalRetail,
                                            booking.currency,
                                            locale
                                        )}
                                    />
                                    {isPositive(booking.depositAmount) && (
                                        <MoneyRow
                                            label={typDict.depositPaid}
                                            value={money(
                                                booking.depositAmount,
                                                booking.currency,
                                                locale
                                            )}
                                        />
                                    )}
                                    <MoneyRow
                                        label={dict.rowPaid}
                                        value={money(
                                            booking.paidAmount,
                                            booking.currency,
                                            locale
                                        )}
                                    />
                                    {isPositive(booking.balanceAmount) && (
                                        <MoneyRow
                                            label={typDict.remainingBalance}
                                            value={money(
                                                booking.balanceAmount,
                                                booking.currency,
                                                locale
                                            )}
                                        />
                                    )}
                                    <MoneyRow
                                        label={typDict.ref}
                                        value={booking.displayRef}
                                        mono
                                    />
                                    {paymentNote && (
                                        <p className='mt-1 text-[13.5px] leading-[1.6] text-it-text-muted'>
                                            {paymentNote}
                                        </p>
                                    )}
                                </Panel>
                            </div>

                            <div className='mt-4 rounded-[16px] border border-it-heading/10 bg-it-white p-5 sm:p-6'>
                                <TravellerCancelPanel
                                    booking={booking}
                                    dict={dict}
                                    locale={locale}
                                    nowMs={nowMs}
                                />
                                {booking.review.reviewed && (
                                    <p className='mt-3 text-[13.5px] text-it-text-muted'>
                                        {dict.reviewed}
                                    </p>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/** A titled white panel - the thank-you summary card, at card scale. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
    return (
        <div className='flex h-full flex-col gap-4 rounded-[16px] border border-it-heading/10 bg-it-white p-5 sm:p-6'>
            <h4 className='m-0 text-[13px] font-semibold tracking-[0.04em] text-it-text-muted uppercase'>
                {title}
            </h4>
            <div className='flex flex-col gap-3'>{children}</div>
        </div>
    );
}

/** Icon + muted label | right-aligned value, matching the thank-you rows. */
function DetailRow({
    icon,
    label,
    children,
}: {
    icon: string;
    label: string;
    children: ReactNode;
}) {
    return (
        <div className='flex items-center justify-between gap-4'>
            <span className='flex shrink-0 items-center gap-2.5'>
                <Image src={icon} alt='' width={24} height={24} className='size-5' />
                <span className='text-[14.5px] leading-[1.6] text-it-text-muted'>
                    {label}
                </span>
            </span>
            <span className='min-w-0 text-right text-[14.5px] leading-[1.6] text-it-heading'>
                {children}
            </span>
        </div>
    );
}

function MoneyRow({
    label,
    value,
    mono = false,
}: {
    label: string;
    value: string;
    mono?: boolean;
}) {
    return (
        <div className='flex items-baseline justify-between gap-4'>
            <span className='text-[14.5px] leading-[1.6] text-it-text-muted'>
                {label}
            </span>
            <span
                className={`text-right text-[14.5px] leading-[1.6] font-medium text-it-heading ${mono ? 'font-mono' : ''}`}>
                {value}
            </span>
        </div>
    );
}
