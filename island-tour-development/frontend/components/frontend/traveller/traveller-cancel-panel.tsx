'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import type { Locale } from '@/lib/constants/locales';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import type { TravellerBooking } from '@/lib/api/public/traveller';
import { crossFade } from '@/lib/motion';
import { requestCancellationClient } from '@/lib/api/traveller-login';

import { TravellerChip } from './traveller-chip';
import { formatDay } from './traveller-format';

/**
 * Cancellation state and (when allowed) the request form.
 *
 * Everything shown here comes from SERVER verdicts - `cancellationBlockedReason`,
 * `canRequestCancellation`, `requestedInFreeWindow`, `freeCancelDeadline`.
 * Nothing is re-derived from the dates on screen: `localDate`/`startTime` are
 * wall-clock values that mean nothing without the tour's timezone, so a
 * client-side judgement would confidently contradict the API.
 *
 * The request never cancels anything. It opens a request our team processes
 * and confirms by email.
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

    if (booking.cancellationBlockedReason === 'ALREADY_REQUESTED') {
        const note =
            booking.requestedInFreeWindow === true
                ? dict.cancelRequestedInWindow
                : booking.requestedInFreeWindow === false
                  ? dict.cancelRequestedLate
                  : null;
        return (
            <div className='rounded-[12px] bg-it-surface px-4 py-3.5'>
                <TravellerChip label={dict.cancelRequestedChip} tone='pending' />
                <p className='mt-2 text-[13.5px] leading-[1.6] text-it-text-muted'>
                    {dict.cancelRequestedOn.replace(
                        '{date}',
                        formatDay(booking.utcCancellationRequestedAt, locale)
                    )}
                </p>
                {note && (
                    <p className='mt-1.5 text-[13.5px] leading-[1.6] text-it-text-muted'>
                        {note}
                    </p>
                )}
            </div>
        );
    }

    if (booking.cancellationBlockedReason === 'DEPARTED') {
        return (
            <p className='text-[13.5px] leading-[1.6] text-it-text-muted'>
                {dict.cancelDeparted}
            </p>
        );
    }

    if (booking.cancellationBlockedReason === 'NOT_CONFIRMED') {
        return (
            <p className='text-[13.5px] leading-[1.6] text-it-text-muted'>
                {dict.cancelNotConfirmed}
            </p>
        );
    }

    if (!booking.canRequestCancellation) return null;

    // A missing deadline means the free window cannot be evidenced, so it is
    // treated as closed - never promise a refund we cannot back.
    //
    // Compared against the SERVER's request instant, not a live `Date.now()`:
    // reading the clock during render is impure, and this copy must not flip
    // mid-session. The authoritative judgement is the backend's anyway - it
    // stamps the real request time when the form is submitted.
    const deadline = booking.freeCancelDeadline;
    const windowOpen = deadline ? new Date(deadline).getTime() > nowMs : false;

    return (
        <div>
            <p className='text-[13.5px] leading-[1.6] text-it-text-muted'>
                {windowOpen
                    ? dict.cancelFreeUntil.replace(
                          '{date}',
                          formatDay(deadline, locale)
                      )
                    : dict.cancelWindowClosed}
            </p>
            <AnimatePresence mode='wait' initial={false}>
                {confirming ? (
                    <motion.div
                        key='form'
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={crossFade}
                        className='mt-3'>
                        <label
                            htmlFor={`cancel-reason-${booking.id}`}
                            className='mb-1.5 block text-[13px] font-semibold text-it-heading'>
                            {dict.cancelReasonLabel}
                        </label>
                        <textarea
                            id={`cancel-reason-${booking.id}`}
                            rows={2}
                            maxLength={500}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className='w-full rounded-[10px] border border-it-border bg-it-white px-3.5 py-2.5 text-[14px] text-it-ink focus:border-transparent focus:outline-2 focus:outline-it-primary'
                        />
                        <p className='mt-2 text-[13px] leading-[1.6] text-it-text-muted'>
                            {dict.cancelDisclaimer}
                        </p>
                        {failed && (
                            <p
                                role='alert'
                                className='mt-2 text-[13px] text-it-error'>
                                {dict.cancelFailed}
                            </p>
                        )}
                        <div className='mt-3 flex flex-wrap gap-2.5'>
                            <motion.button
                                type='button'
                                disabled={busy}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => void submit()}
                                className='rounded-full border-[1.5px] border-it-error px-4.5 py-2.25 text-[14px] font-semibold text-it-error transition-colors hover:bg-it-error-subtle disabled:opacity-60'>
                                {busy ? dict.cancelSending : dict.cancelConfirm}
                            </motion.button>
                            <motion.button
                                type='button'
                                disabled={busy}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setConfirming(false)}
                                className='rounded-full px-4.5 py-2.25 text-[14px] font-semibold text-it-text-muted transition-colors hover:text-it-heading disabled:opacity-60'>
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
                        className='mt-3 rounded-full border-[1.5px] border-it-heading/20 px-4.5 py-2.25 text-[14px] font-semibold text-it-heading transition-colors hover:border-it-heading/40'>
                        {dict.cancelCta}
                    </motion.button>
                )}
            </AnimatePresence>
        </div>
    );
}
