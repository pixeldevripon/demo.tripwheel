'use client';

import { CANCEL_CARD_SHELL } from '@/components/frontend/cancel/cancel-card-shell';
import { ConfirmDialog } from '@/components/frontend/confirm-dialog';
import { requestBookingCancellation } from '@/lib/api/bookings';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { crossFade } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { useState } from 'react';

type CancelDict = Dictionary['cancelBooking'];

type SubmitState = 'idle' | 'sending' | 'sent' | 'failed';

/**
 * The cancellation-request card (master 6.4/C1: "Cancel {tour}, {date}?
 * Refund ${deposit}" - the refund line renders only when the amount is above
 * zero, C23). The email's "Cancel booking" button only ever opens this form -
 * it never cancels on click. Submitting emails the request to the Island Tours
 * admin, who processes the refund; the traveller and operator are notified.
 */
export function CancelRequestCard({
    dict,
    publicRef,
    title,
    displayRef,
    refundLabel,
    thankYouHref,
}: {
    dict: CancelDict;
    publicRef: string;
    /** Master-format title, already substituted: "Cancel {tour}, {date}?" */
    title: string;
    /**
     * Null only in theory: this card renders behind the page's verified gate,
     * and the reference is withheld from unverified payloads. Typed honestly
     * so the reference row is skipped rather than printing "Reference null".
     */
    displayRef: string | null;
    /** "Refund $48" - null when nothing was paid to Island Tours (C23). */
    refundLabel: string | null;
    /** "Keep my booking" returns the traveller to their TYP. */
    thankYouHref: string;
}) {
    const [state, setState] = useState<SubmitState>('idle');
    /** The are-you-sure modal (QA follow-up 2026-08-02). */
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [reason, setReason] = useState('');

    async function submit() {
        if (state === 'sending') return;
        setState('sending');
        try {
            await requestBookingCancellation(publicRef, reason);
            setState('sent');
        } catch {
            // Covers the hard throttle (429) and transport errors alike - the
            // traveller retries or takes the WhatsApp route.
            setState('failed');
        } finally {
            setConfirmOpen(false);
        }
    }

    return (
        <div className={CANCEL_CARD_SHELL}>
            <AnimatePresence mode='wait' initial={false}>
                {state === 'sent' ? (
                    <motion.div
                        key='sent'
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={crossFade}
                        className='flex flex-col gap-2.5'>
                        <span className='font-medium text-[18px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                            {dict.sentTitle}
                        </span>
                        <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.sentBody}
                        </span>
                        {/* After the request is in there is nothing left to
                            "keep" - the way forward is watching the status on
                            the thank-you page. */}
                        <Link
                            href={thankYouHref}
                            className='mt-3 w-fit rounded-[10px] border-[1.5px] border-it-heading/20 px-4.5 py-2.75 text-[14px] font-medium leading-[1.2] text-it-heading no-underline transition-colors duration-300 hover:border-it-heading/40 tracking-[-0.012em]'>
                            {dict.seeStatus}
                        </Link>
                    </motion.div>
                ) : (
                    <motion.div
                        key='form'
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={crossFade}
                        className='flex flex-col'>
                        <span className='font-medium text-[18px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                            {title}
                        </span>
                        {displayRef && (
                            <span className='mt-2 text-[13px] leading-[1.6] tracking-[-0.012em] text-it-heading/50'>
                                {dict.reference} {displayRef}
                            </span>
                        )}

                        {refundLabel && (
                            <span className='mt-3 w-fit rounded-full bg-it-green/8 px-3 py-1 text-[14px] font-medium leading-[1.6] tracking-[-0.012em] text-it-green'>
                                {refundLabel}
                            </span>
                        )}
                        <span className='mt-2.5 text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.refundNote}
                            {refundLabel ? ` ${dict.refundMethod}` : ''}
                        </span>

                        <textarea
                            rows={3}
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                            maxLength={500}
                            placeholder={dict.reasonPlaceholder}
                            className='mt-4 w-full resize-y rounded-[10px] border-[1.5px] border-it-heading/20 bg-it-white px-3 py-2.75 text-[16px] md:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading outline-none transition-colors duration-300 placeholder:text-it-heading/40 focus:border-it-heading/50'
                        />

                        <AnimatePresence>
                            {state === 'failed' && (
                                <motion.span
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    transition={crossFade}
                                    className='mt-2 text-[13px] leading-[1.6] text-it-primary tracking-[-0.012em]'>
                                    {dict.error}
                                </motion.span>
                            )}
                        </AnimatePresence>

                        <div className='mt-4 flex flex-wrap items-center gap-2.5'>
                            <motion.button
                                type='button'
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setConfirmOpen(true)}
                                disabled={state === 'sending'}
                                className='cursor-pointer rounded-[10px] border-none bg-it-heading px-4.5 py-2.75 text-[14px] font-medium leading-[1.2] text-it-white transition-opacity duration-300 hover:opacity-90 disabled:cursor-default disabled:opacity-60 tracking-[-0.012em]'>
                                {state === 'sending'
                                    ? dict.sending
                                    : dict.confirm}
                            </motion.button>
                            <Link
                                href={thankYouHref}
                                className='rounded-[10px] border-[1.5px] border-it-heading/20 px-4.5 py-2.75 text-[14px] font-medium leading-[1.2] text-it-heading no-underline transition-colors duration-300 hover:border-it-heading/40 tracking-[-0.012em]'>
                                {dict.keep}
                            </Link>
                        </div>
                        {/* One more explicit yes before the request fires
                            (QA follow-up 2026-08-02). Reuses the card's own
                            already-substituted question and refund note. */}
                        <ConfirmDialog
                            open={confirmOpen}
                            title={title}
                            body={
                                refundLabel
                                    ? `${refundLabel}. ${dict.refundNote} ${dict.refundMethod}`
                                    : dict.refundNote
                            }
                            confirmLabel={dict.confirm}
                            cancelLabel={dict.keep}
                            busy={state === 'sending'}
                            destructive
                            onConfirm={() => void submit()}
                            onClose={() => setConfirmOpen(false)}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

