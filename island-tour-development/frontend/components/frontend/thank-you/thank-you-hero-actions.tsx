'use client';

import { resendConfirmationEmail } from '@/lib/api/bookings';
import { springPop, swapFade } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

/**
 * The TYP hero's interactive client leaves (STRONG RULE: the hero shell stays
 * a server component). All are self-contained: the copy button owns the
 * clipboard state, the calendar menu its open state, the resend line its
 * request + result state.
 */

/** "Copy" text button inside the booking-ref pill - flips to "Copied". */
export function BookingRefCopy({
    displayRef,
    copyLabel,
    copiedLabel,
    ariaLabel,
}: {
    displayRef: string;
    copyLabel: string;
    copiedLabel: string;
    ariaLabel: string;
}) {
    const [copied, setCopied] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function handleCopy() {
        // writeText can throw synchronously (permission denied / insecure
        // context) - the visual confirmation must survive either way.
        try {
            void navigator.clipboard?.writeText(displayRef).catch(() => {});
        } catch {
            // clipboard unavailable - still show the feedback
        }
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
    }

    return (
        <motion.button
            type='button'
            onClick={handleCopy}
            whileTap={{ scale: 0.97 }}
            transition={springPop}
            aria-label={ariaLabel}
            aria-live='polite'
            className='cursor-pointer border-none bg-transparent p-0 text-[12.5px] font-medium leading-[1.4] text-it-primary-hover underline underline-offset-2 tracking-[-0.012em]'>
            {copied ? copiedLabel : copyLabel}
        </motion.button>
    );
}

export type AddToCalendarLabels = {
    button: string;
    google: string;
    apple: string;
    outlook: string;
    ics: string;
};

/**
 * "Add to calendar" split control (design v2 .calbtn/.calpanel, DELTA-01):
 * orange CTA that opens a 230px dropdown of provider targets - Google/Outlook
 * deeplinks in a new tab, Apple + "Download .ics" both hitting the backend's
 * one-event .ics.
 */
export function AddToCalendar({
    googleUrl,
    outlookUrl,
    icsUrl,
    labels,
}: {
    googleUrl: string;
    outlookUrl: string;
    icsUrl: string;
    labels: AddToCalendarLabels;
}) {
    const [open, setOpen] = useState(false);
    const wrapRef = useRef<HTMLDivElement>(null);

    // Light-dismiss: outside click or Escape closes the panel.
    useEffect(() => {
        if (!open) return;
        function onPointerDown(event: MouseEvent | TouchEvent) {
            if (!wrapRef.current?.contains(event.target as Node))
                setOpen(false);
        }
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpen(false);
        }
        document.addEventListener('mousedown', onPointerDown);
        document.addEventListener('touchstart', onPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onPointerDown);
            document.removeEventListener('touchstart', onPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [open]);

    const itemClass =
        'flex w-full cursor-pointer items-center gap-2.5 rounded-it-sm px-3 py-2.5 text-left text-[13.5px] font-medium leading-[1.4] text-it-heading no-underline transition-colors duration-(--it-duration-xs) hover:bg-it-bg tracking-[-0.012em]';

    const options = [
        {
            key: 'google',
            label: labels.google,
            href: googleUrl,
            icon: '/icons/thank-you/cal-google-soft.svg',
            newTab: true,
            download: false,
        },
        {
            key: 'apple',
            label: labels.apple,
            href: icsUrl,
            icon: '/icons/thank-you/cal-google-soft.svg',
            newTab: false,
            download: false,
        },
        {
            key: 'outlook',
            label: labels.outlook,
            href: outlookUrl,
            icon: '/icons/thank-you/cal-google-soft.svg',
            newTab: true,
            download: false,
        },
        {
            key: 'ics',
            label: labels.ics,
            href: icsUrl,
            icon: '/icons/thank-you/cal-download-soft.svg',
            newTab: false,
            download: true,
        },
    ];

    return (
        <div ref={wrapRef} className='relative inline-block'>
            <motion.button
                type='button'
                onClick={() => setOpen(v => !v)}
                whileTap={{ scale: 0.98 }}
                transition={springPop}
                aria-expanded={open}
                aria-haspopup='menu'
                className='flex cursor-pointer items-center gap-[9px] rounded-it-sm border-none bg-it-primary px-[26px] py-[13px] text-[16px] font-medium leading-[1.5] text-it-white transition-colors duration-(--it-duration-xs) hover:bg-it-primary-hover tracking-[-0.012em]'>
                <Image
                    src='/icons/thank-you/calendar-white.svg'
                    alt=''
                    width={24}
                    height={24}
                    className='size-[17px] shrink-0'
                />
                {labels.button}
                <Image
                    src='/icons/thank-you/arrow-down-white.svg'
                    alt=''
                    width={16}
                    height={16}
                    className={`size-3.5 shrink-0 transition-transform duration-(--it-duration-xs) ${open ? 'rotate-180' : ''}`}
                />
            </motion.button>
            <AnimatePresence>
                {open && (
                    // Centering transform lives on this STATIC wrapper - motion
                    // writes an inline transform, so translateX(-50%) on the
                    // animated node itself would be overwritten mid-animation.
                    <div className='absolute left-1/2 top-[calc(100%+8px)] z-40 -translate-x-1/2'>
                        <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            transition={swapFade}
                            role='menu'
                            className='w-[230px] rounded-it-md bg-it-white p-2 text-left shadow-it-lg'>
                            {options.map(option => (
                                <a
                                    key={option.key}
                                    href={option.href}
                                    role='menuitem'
                                    onClick={() => setOpen(false)}
                                    className={itemClass}
                                    {...(option.newTab
                                        ? {
                                              target: '_blank',
                                              rel: 'noopener noreferrer',
                                          }
                                        : {})}
                                    {...(option.download
                                        ? { download: '' }
                                        : {})}>
                                    <Image
                                        src={option.icon}
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-4 shrink-0'
                                    />
                                    {option.label}
                                </a>
                            ))}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}

type ResendState = 'idle' | 'sending' | 'sent' | 'failed';

/** "Don't see it? ... Resend email" line, wired to the transactional resend. */
export function ResendEmailLine({
    publicRef,
    helpPrefix,
    resendLabel,
    resentLabel,
    sendingLabel,
    failedLabel,
}: {
    publicRef: string;
    helpPrefix: string;
    resendLabel: string;
    resentLabel: string;
    sendingLabel: string;
    failedLabel: string;
}) {
    const [state, setState] = useState<ResendState>('idle');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // The confirmation is transient; the failure is not. A "couldn't send" that
    // disappears on its own would leave the traveler assuming it worked.
    useEffect(() => {
        if (state !== 'sent') return;
        timer.current = setTimeout(() => setState('idle'), 2400);
        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [state]);

    async function handleResend() {
        if (state === 'sending') return; // guard the double-click into the 1-per-10s throttle
        setState('sending');
        try {
            await resendConfirmationEmail(publicRef);
            setState('sent');
        } catch {
            // Includes a 429 from the backend throttle. "Try again" is the right
            // instruction either way, so the copy does not branch on the cause.
            setState('failed');
        }
    }

    return (
        <AnimatePresence mode='wait' initial={false}>
            {state === 'sent' ? (
                <motion.p
                    key='resent'
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={swapFade}
                    className='m-0'>
                    {resentLabel}
                </motion.p>
            ) : (
                <motion.p
                    key='help'
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={swapFade}
                    className='m-0'>
                    {state === 'failed' ? failedLabel : helpPrefix}{' '}
                    <button
                        type='button'
                        onClick={handleResend}
                        disabled={state === 'sending'}
                        aria-live='polite'
                        className='cursor-pointer text-it-primary-hover underline underline-offset-2 disabled:cursor-default disabled:no-underline disabled:opacity-60 tracking-[-0.012em]'>
                        {state === 'sending' ? sendingLabel : resendLabel}
                    </button>
                </motion.p>
            )}
        </AnimatePresence>
    );
}

