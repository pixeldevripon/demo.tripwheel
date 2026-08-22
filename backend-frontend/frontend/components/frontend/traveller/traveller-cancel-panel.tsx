'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { TravellerBooking } from '@/lib/api/public/traveller';
import {
    requestCancellationClient,
    withdrawCancellationClient,
} from '@/lib/api/traveller-login';
import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { crossFade } from '@/lib/motion';

import { TravellerChip } from './traveller-chip';
import {
    formatDay,
    formatDayShort,
    formatDeadline,
    isPositive,
    money,
} from './traveller-format';
import { freeWindowOpen } from './traveller-groups';

/**
 * Cancellation state and (when allowed) the inline confirm strip (review 5.4):
 * "Cancel {tour}, {date}? Refund {amount}." - the refund line only above zero.
 *
 * Everything shown here comes from SERVER verdicts - `cancellationBlockedReason`,
 * `canRequestCancellation`, `requestedInFreeWindow`, `freeCancelDeadline`.
 * Nothing is re-derived from the dates on screen: `localDate`/`startTime` are
 * wall-clock values that mean nothing without the tour's timezone.
 *
 * The request never cancels anything. It opens a request our team processes
 * and confirms by email; the deadline is judged on the request instant (C23).
 */
export function TravellerCancelPanel({
    booking,
    dict,
    locale,
    nowMs,
}: {
    booking: TravellerBooking;
    dict: Dictionary['traveller'];
    locale: Locale;
    /** Request instant stamped by the server - see the deadline note below. */
    nowMs: number;
}) {
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);
    const [failed, setFailed] = useState(false);

    async function submit() {
        if (busy) return;
        setBusy(true);
        setFailed(false);
        const ok = await requestCancellationClient(
            booking.publicRef,
            reason.trim() || undefined
        );
        setBusy(false);
        if (!ok) {
            setFailed(true);
            return;
        }
        setConfirming(false);
        // Re-render from the server so the row shows its new requested state.
        router.refresh();
    }

    async function withdraw() {
        if (busy) return;
        setBusy(true);
        setFailed(false);
        const ok = await withdrawCancellationClient(booking.publicRef);
        setBusy(false);
        if (!ok) {
            setFailed(true);
            return;
        }
        // Re-render from the server so the row returns to its normal state.
        router.refresh();
    }

    if (booking.cancellationBlockedReason === 'ALREADY_REQUESTED') {
        const note =
            booking.requestedInFreeWindow === true
                ? dict.cancelRequestedInWindow.replace(
                      '{amount}',
                      money(booking.paidAmount, booking.currency, locale)
                  )
                : booking.requestedInFreeWindow === false
                  ? dict.cancelRequestedLate
                  : null;
        return (
            <div className='rounded-[12px] bg-it-surface px-4 py-3.5'>
                <TravellerChip
                    label={dict.cancelRequestedChip}
                    tone='pending'
                />
                <p className='mt-2 mb-0 text-[12px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                    {dict.cancelRequestedOn.replace(
                        '{date}',
                        formatDay(booking.utcCancellationRequestedAt, locale)
                    )}
                </p>
                {note && (
                    <p className='mt-1.5 mb-0 text-[12px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                        {note}
                    </p>
                )}
                {/* The way back (QA 2026-08-01): while the request is still
                    pending - i.e. no admin has executed it - the traveller can
                    withdraw it themselves and the booking simply stands. */}
                {failed && (
                    <p
                        role='alert'
                        className='mt-2 mb-0 text-[12px] text-it-error tracking-[-0.012em]'>
                        {dict.cancelFailed}
                    </p>
                )}
                <motion.button
                    type='button'
                    disabled={busy}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => void withdraw()}
                    className='mt-3 rounded-full border-[1.5px] border-it-heading/20 px-4.5 py-2.25 text-[13px] font-medium text-it-heading transition-colors hover:border-it-heading/40 disabled:opacity-60 tracking-[-0.012em]'>
                    {busy ? dict.cancelWithdrawing : dict.cancelWithdraw}
                </motion.button>
            </div>
        );
    }

    if (booking.cancellationBlockedReason === 'NOT_CONFIRMED') {
        return (
            <p className='m-0 text-[12px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                {dict.cancelNotConfirmed}
            </p>
        );
    }

    if (booking.cancellationBlockedReason === 'DEPARTED') return null;

    // `freeWindowOpen` carries the rule (missing deadline = closed) and the
    // reason it is judged against the server's instant - see traveller-groups.
    const deadline = booking.freeCancelDeadline;
    const windowOpen = freeWindowOpen(deadline, nowMs);
    const refundable = isPositive(booking.paidAmount);

    // Locked 6.3 family (F10): every money deadline carries the weekday, the
    // time of day and "(local time)".
    const windowLine = deadline
        ? (windowOpen ? dict.cancelFreeUntil : dict.cancelWindowClosed).replace(
              '{deadline}',
              formatDeadline(deadline, locale)
          )
        : dict.cancelWindowUnknown;

    if (!booking.canRequestCancellation) {
        return (
            <p className='m-0 text-[12px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                {windowLine}
            </p>
        );
    }

    // One composed question ("Cancel {tour}, {date}? Refund {amount}.") shared
    // by the strip heading and the confirm modal, so they can never disagree.
    const stripTitle =
        dict.cancelStripTitle
            .replace('{tour}', booking.tourName)
            .replace('{date}', formatDayShort(booking.localDate, locale)) +
        (refundable && windowOpen
            ? ` ${dict.cancelStripRefund.replace(
                  '{amount}',
                  money(booking.paidAmount, booking.currency, locale)
              )}`
            : '');

    return (
        <div>
            <p className='m-0 text-[12px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                {windowLine}
            </p>
            {/* Self-service date change (review 10.4) is BUILT but HIDDEN for
                v1 (founder call 2026-07-30): render <TravellerDateChange
                booking dict locale /> here (inside a windowOpen check) to
                re-enable - the backend endpoints, proxy and copy all exist. */}
            <AnimatePresence mode='wait' initial={false}>
                {confirming ? (
                    <motion.div
                        key='strip'
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={crossFade}
                        className='mt-3 rounded-[12px] bg-it-surface p-4'>
                        {/* Refund segment only above zero (6.4 pattern) -
                            composed into stripTitle above. */}
                        <p className='m-0 text-[13px] leading-[1.6] font-medium text-it-heading tracking-[-0.012em]'>
                            {stripTitle}
                        </p>
                        <p className='mt-1.5 mb-0 text-[12px] leading-[1.6] text-it-text-muted tracking-[-0.012em]'>
                            {dict.cancelStripNote}
                        </p>
                        <label
                            htmlFor={`cancel-reason-${booking.id}`}
                            className='mt-3 mb-1.5 block text-[12px] font-medium text-it-heading tracking-[-0.012em]'>
                            {dict.cancelReasonLabel}
                        </label>
                        <textarea
                            id={`cancel-reason-${booking.id}`}
                            rows={2}
                            maxLength={500}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            className='w-full rounded-[10px] border border-it-border bg-it-white px-3.5 py-2.5 text-[16px] md:text-[14.5px] text-it-heading focus:border-transparent focus:outline-2 focus:outline-it-primary tracking-[-0.012em]'
                        />
                        {failed && (
                            <p
                                role='alert'
                                className='mt-2 mb-0 text-[12px] text-it-error tracking-[-0.012em]'>
                                {dict.cancelFailed}
                            </p>
                        )}
                        {/* The strip IS the confirmation (founder call
                            2026-08-02: no extra modal here - the /cancel page
                            keeps its dialog, this inline step is enough). */}
                        <div className='mt-3 flex flex-wrap gap-2.5'>
                            <motion.button
                                type='button'
                                disabled={busy}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => void submit()}
                                className='rounded-full border-[1.5px] border-it-error px-4.5 py-2.25 text-[13px] font-medium text-it-error transition-colors hover:bg-it-error-subtle disabled:opacity-60 tracking-[-0.012em]'>
                                {busy ? dict.cancelSending : dict.cancelConfirm}
                            </motion.button>
                            <motion.button
                                type='button'
                                disabled={busy}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setConfirming(false)}
                                className='rounded-full px-4.5 py-2.25 text-[13px] font-medium text-it-text-muted transition-colors hover:text-it-heading disabled:opacity-60 tracking-[-0.012em]'>
                                {dict.cancelKeep}
                            </motion.button>
                        </div>
                    </motion.div>
                ) : (
                    <motion.button
                        key='trigger'
                        type='button'
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={crossFade}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setConfirming(true)}
                        className='mt-3 rounded-full border-[1.5px] border-it-heading/20 px-4.5 py-2.25 text-[13px] font-medium text-it-heading transition-colors hover:border-it-heading/40 tracking-[-0.012em]'>
                        {dict.cancelCta}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}

