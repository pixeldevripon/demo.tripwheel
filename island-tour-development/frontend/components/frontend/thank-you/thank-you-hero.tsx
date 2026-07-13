'use client';

import { MountReveal } from '@/components/frontend/mount-reveal';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { buildCalendarUrl, type ThankYouBooking } from '@/lib/thank-you/thank-you';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';

type ThankYouDict = Dictionary['thankYou'];

const POP = { type: 'spring', stiffness: 500, damping: 30 } as const;

/**
 * TYP hero (Figma 47744-9185): green check, "You're booked" headline, booking
 * ref chip with copy-to-clipboard, add-to-calendar CTA and the confirmation
 * email note with a resend action. Streams inside the page Suspense boundary,
 * so everything reveals on mount.
 */
export function ThankYouHero({
    booking,
    dict,
}: {
    booking: ThankYouBooking;
    dict: ThankYouDict;
}) {
    const [copied, setCopied] = useState(false);
    const [resent, setResent] = useState(false);
    const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function handleCopy() {
        void navigator.clipboard?.writeText(booking.displayRef);
        setCopied(true);
        if (copyTimer.current) clearTimeout(copyTimer.current);
        copyTimer.current = setTimeout(() => setCopied(false), 2000);
    }

    function handleResend() {
        // Demo: the transactional resend endpoint lands with the booking module.
        setResent(true);
        if (resendTimer.current) clearTimeout(resendTimer.current);
        resendTimer.current = setTimeout(() => setResent(false), 2400);
    }

    return (
        <section className='bg-it-white pt-12 pb-16 md:pt-[85px] md:pb-[116px]'>
            <div className='it-container flex flex-col items-center gap-14'>
                <MountReveal className='flex w-full flex-col items-center gap-8'>
                    <div className='flex flex-col items-center gap-8'>
                        <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ ...POP, delay: 0.15 }}
                            className='shrink-0'>
                            <Image
                                src='/icons/thank-you/success-check.svg'
                                alt=''
                                width={56}
                                height={56}
                                className='size-14'
                            />
                        </motion.span>
                        <div className='flex flex-col items-center gap-1'>
                            <h1 className='m-0 text-center font-medium text-[32px] md:text-[48px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                {dict.title.replace('{name}', booking.guestFirstName)}
                            </h1>
                            <p className='m-0 text-center text-[16px] leading-[1.6] tracking-[-0.012em] text-it-ink/60'>
                                {dict.subtitle
                                    .replace('{tour}', booking.tourTitle)
                                    .replace('{date}', booking.dateLabel)
                                    .replace('{time}', booking.startTimeLabel)}
                            </p>
                        </div>
                    </div>
                    <div className='flex items-center gap-2'>
                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            {dict.bookingRef}
                        </span>
                        <motion.button
                            type='button'
                            onClick={handleCopy}
                            whileTap={{ scale: 0.97 }}
                            transition={POP}
                            aria-label={`${dict.bookingRef} ${booking.displayRef}`}
                            className='flex h-[42px] w-[204px] cursor-pointer items-center justify-between rounded-[8px] bg-it-surface px-4'>
                            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                {booking.displayRef}
                            </span>
                            <AnimatePresence mode='wait' initial={false}>
                                <motion.span
                                    key={copied ? 'copied' : 'copy'}
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    exit={{ scale: 0 }}
                                    transition={POP}
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
                    </div>
                </MountReveal>
                <MountReveal delay={0.15} className='flex flex-col items-center gap-8'>
                    <motion.a
                        href={buildCalendarUrl(booking)}
                        target='_blank'
                        rel='noopener noreferrer'
                        whileTap={{ scale: 0.98 }}
                        transition={POP}
                        className='flex items-center gap-2.5 rounded-full bg-it-primary px-10 py-[15px] transition-colors hover:bg-it-primary-hover'>
                        <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                            {dict.addToCalendar}
                        </span>
                        <Image
                            src='/icons/thank-you/arrow-down-white.svg'
                            alt=''
                            width={16}
                            height={16}
                            className='size-4'
                        />
                    </motion.a>
                    <div className='flex flex-col items-center text-center text-[16px] leading-[1.6] tracking-[-0.012em] text-it-ink/60'>
                        <p className='m-0'>
                            {dict.emailSentTo.replace('{email}', booking.guestEmail)}
                        </p>
                        <AnimatePresence mode='wait' initial={false}>
                            {resent ? (
                                <motion.p
                                    key='resent'
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className='m-0'>
                                    {dict.emailResent}
                                </motion.p>
                            ) : (
                                <motion.p
                                    key='help'
                                    initial={{ opacity: 0, y: 6 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -6 }}
                                    transition={{ duration: 0.15 }}
                                    className='m-0'>
                                    {dict.emailHelpPrefix}{' '}
                                    <button
                                        type='button'
                                        onClick={handleResend}
                                        className='cursor-pointer underline underline-offset-2'>
                                        {dict.resendEmail}
                                    </button>
                                </motion.p>
                            )}
                        </AnimatePresence>
                    </div>
                </MountReveal>
            </div>
        </section>
    );
}
