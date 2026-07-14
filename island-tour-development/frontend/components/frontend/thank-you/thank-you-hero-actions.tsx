'use client';

import { springPop, swapFade } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';

/**
 * The TYP hero's interactive client leaves (STRONG RULE: the hero shell stays
 * a server component). Both are self-contained: the ref chip owns the
 * copy-to-clipboard state, the resend line owns its demo confirmation swap.
 */

/** Booking-ref chip - tap copies the ref; the icon springs to a green check. */
export function BookingRefChip({
    displayRef,
    ariaLabel,
}: {
    displayRef: string;
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
            className='flex h-[42px] w-[204px] cursor-pointer items-center justify-between rounded-[8px] bg-it-surface px-4'>
            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                {displayRef}
            </span>
            <AnimatePresence mode='wait' initial={false}>
                <motion.span
                    key={copied ? 'copied' : 'copy'}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    transition={springPop}
                    className='flex size-5 items-center justify-center'>
                    <Image
                        src={
                            copied
                                ? '/icons/check-green.svg'
                                : '/icons/thank-you/copy.svg'
                        }
                        alt=''
                        width={20}
                        height={20}
                        className='size-5'
                    />
                </motion.span>
            </AnimatePresence>
        </motion.button>
    );
}

/** "Don't see it? ... Resend email" line with the animated demo confirmation. */
export function ResendEmailLine({
    helpPrefix,
    resendLabel,
    resentLabel,
}: {
    helpPrefix: string;
    resendLabel: string;
    resentLabel: string;
}) {
    const [resent, setResent] = useState(false);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function handleResend() {
        // Demo: the transactional resend endpoint lands with the booking module.
        setResent(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setResent(false), 2400);
    }

    return (
        <AnimatePresence mode='wait' initial={false}>
            {resent ? (
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
                    {helpPrefix}{' '}
                    <button
                        type='button'
                        onClick={handleResend}
                        className='cursor-pointer underline underline-offset-2'>
                        {resendLabel}
                    </button>
                </motion.p>
            )}
        </AnimatePresence>
    );
}
