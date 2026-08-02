'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';

import type { TravellerBooking } from '@/lib/api/public/traveller';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { crossFade } from '@/lib/motion';

import { TravellerBookingPanel } from './traveller-booking-panel';
import { bookingTone, paymentChipFor, TravellerChip } from './traveller-chip';
import {
    bookingMetaLine,
    formatDeadline,
    isPositive,
    lookupLabel,
    mapsUrl,
    money,
    onArrivalLine,
    payBalanceLine,
} from './traveller-format';
import { daysUntil, freeWindowOpen } from './traveller-groups';
import { bookingIcsUrl } from '@/lib/booking-ics';

/**
 * The next-trip hero (review 5.2, final.html layout) - replaces the stat
 * tiles. Photo on the left; on the right the kicker ("Next trip · in {n}
 * days", plain, no countdown theater), title, meta row, the logistics line
 * with the 4.4 be-ready buffer and Maps link, chips, ONE model-aware payment
 * line, a short cancellation status line, then "View details" (expands the
 * standard shared panel) and "Add to calendar" - the backend's tokenized
 * public .ics download (the same one the confirmation email links; the TYP
 * page uses a Google-Calendar web link instead).
 *
 * Deliberately NO WhatsApp button up here (founder): support entry points sit
 * lower - the per-booking support row and the NeedHelp block.
 */
export function TravellerNextTrip({
    booking,
    dict,
    typDict,
    locale,
    nowMs,
    whatsappHref,
}: {
    booking: TravellerBooking;
    dict: Dictionary['traveller'];
    typDict: Dictionary['thankYou'];
    locale: Locale;
    nowMs: number;
    whatsappHref: string | null;
}) {
    const [open, setOpen] = useState(false);

    const days = daysUntil(booking.localDate, nowMs);
    const when =
        days <= 0
            ? dict.nextTripToday
            : days === 1
              ? dict.nextTripTomorrow
              : dict.nextTripInDays.replace('{count}', String(days));

    const metaLine = bookingMetaLine(booking, dict, locale);

    const hasPickup = Boolean(booking.pickupAddress);
    // Pickup rows carry a Maps link too (founder 2026-07-30).
    const maps = hasPickup
        ? mapsUrl(null, null, booking.pickupAddress)
        : mapsUrl(
              booking.meetingPointLat,
              booking.meetingPointLng,
              booking.meetingPoint
          );
    const buffer = booking.arrivalBufferMinutes;

    const statusLabel = lookupLabel(dict.bookingStatus, booking.displayStatus);
    const paidChipAmount = isPositive(booking.depositAmount)
        ? money(booking.depositAmount, booking.currency, locale)
        : undefined;

    // ONE payment line, model- and window-aware (same 5.5 vocabulary the
    // panel's payment box uses in full).
    const deadline = booking.freeCancelDeadline;
    const windowOpen = freeWindowOpen(deadline, nowMs);
    const operatorName = booking.operator.name ?? dict.operatorFallback;
    const balance = money(booking.balanceAmount, booking.currency, locale);
    const payLine =
        booking.paymentModel === 'OPERATOR_FULL'
            ? dict.payOperatorFull
                  .replace(
                      '{amount}',
                      money(booking.totalRetail, booking.currency, locale)
                  )
                  .replace('{operator}', operatorName)
            : booking.paymentModel === 'PAID_IN_FULL'
              ? `${dict.payPaidInFull} ${money(booking.totalRetail, booking.currency, locale)}`
              : booking.paymentModel === 'ON_ARRIVAL'
                ? onArrivalLine(booking.onArrivalPayment, dict)
                : isPositive(booking.balanceAmount)
                  ? payBalanceLine(
                        { balance, operatorName, deadline, windowOpen },
                        dict,
                        locale
                    )
                  : null;

    const cancelLine = deadline
        ? (windowOpen ? dict.cancelFreeUntil : dict.cancelWindowClosed).replace(
              '{deadline}',
              formatDeadline(deadline, locale)
          )
        : null;

    return (
        <section
            aria-label={dict.nextTripKicker}
            className='overflow-hidden rounded-[16px] border border-it-heading/10 bg-it-white'>
            <div className='md:flex'>
                {booking.tourImageUrl && (
                    <div className='relative h-[200px] shrink-0 bg-it-border md:h-auto md:w-[340px]'>
                        <Image
                            src={booking.tourImageUrl}
                            alt=''
                            fill
                            sizes='(max-width: 768px) 100vw, 340px'
                            className='object-cover'
                        />
                    </div>
                )}
                <div className='min-w-0 flex-1 p-5 sm:p-7'>
                    <p className='m-0 text-[12.5px] font-semibold tracking-[0.08em] text-it-primary uppercase'>
                        {dict.nextTripKicker} · {when}
                    </p>
                    <h2 className='mt-2 mb-0 font-normal text-[22px] leading-[1.3] tracking-[-0.012em] text-it-heading md:text-[24px]'>
                        {booking.tourName}
                    </h2>
                    <p className='mt-1 mb-0 text-[15px] leading-[1.6] text-it-text-muted'>
                        {metaLine}
                    </p>

                    {(booking.meetingPoint || hasPickup) && (
                        <p className='mt-2.5 mb-0 flex flex-wrap items-center gap-x-1.5 text-[14.5px] leading-[1.6] text-it-heading'>
                            <Image
                                src='/icons/thank-you/detail-location.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-4.5'
                            />
                            <span>
                                {hasPickup
                                    ? `${dict.rowPickup}: ${booking.pickupAddress}`
                                    : `${dict.rowMeetingPoint}: ${booking.meetingPoint}`}
                                {buffer ? (
                                    <span className='text-it-text-muted'>
                                        {' · '}
                                        {(hasPickup
                                            ? dict.beReadyEarly
                                            : dict.beThereEarly
                                        ).replace('{minutes}', String(buffer))}
                                    </span>
                                ) : null}
                                {maps && (
                                    <>
                                        {' · '}
                                        <a
                                            href={maps}
                                            target='_blank'
                                            rel='noopener noreferrer'
                                            className='font-normal text-it-primary no-underline hover:opacity-80'>
                                            {dict.mapsLink}
                                        </a>
                                    </>
                                )}
                            </span>
                        </p>
                    )}

                    <div className='mt-3 flex flex-wrap items-center gap-1.5'>
                        <TravellerChip
                            label={statusLabel}
                            tone={bookingTone(booking.displayStatus)}
                        />
                        {paymentChipFor(booking, dict, paidChipAmount)}
                    </div>

                    {payLine && (
                        <p className='mt-3 mb-0 text-[14.5px] leading-[1.6] text-it-heading'>
                            {payLine}
                        </p>
                    )}
                    {cancelLine && (
                        <p className='mt-1 mb-0 text-[13.5px] leading-[1.6] text-it-text-muted'>
                            {cancelLine}
                        </p>
                    )}

                    <div className='mt-4 flex flex-wrap items-center gap-2.5'>
                        <motion.button
                            type='button'
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setOpen(v => !v)}
                            aria-expanded={open}
                            aria-controls='traveller-next-panel'
                            className='rounded-full bg-it-primary px-5 py-2.5 text-[14px] font-semibold text-it-primary-fg transition-[filter] hover:brightness-95'>
                            {open ? dict.hideDetails : dict.viewDetails}
                        </motion.button>
                        <a
                            href={bookingIcsUrl(booking.publicRef)}
                            className='rounded-full border-[1.5px] border-it-heading/20 px-5 py-2.5 text-[14px] font-semibold text-it-heading no-underline transition-colors hover:border-it-heading/40'>
                            {dict.addToCalendar}
                        </a>
                    </div>
                </div>
            </div>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        key='next-panel'
                        id='traveller-next-panel'
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
                            active
                            past={false}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}

