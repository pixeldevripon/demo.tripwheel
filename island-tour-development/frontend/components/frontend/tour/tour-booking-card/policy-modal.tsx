'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { springPop } from '@/lib/motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { PolicyModalDict } from '@/lib/tours/booking';

/**
 * Policy detail modal (Figma "Free cancellation" 48125:20233 / "Pay later"
 * 48125:21537). Both share one shell - white card, 1px ink border, 32px title
 * over a divider, a lead-in block, an orange "HOW IT WORKS" box, and a closing
 * block - so a single component renders either via its `content`. `fill`
 * interpolates the `{hours}` / `{pct}` placeholders from the live tour data.
 *
 * Fully self-contained: it owns its portal mount, escape-to-close, and scroll
 * lock; the caller only toggles `open` and supplies the copy.
 */
export function PolicyModal({
    open,
    onClose,
    content,
    closeLabel,
    fill,
}: {
    open: boolean;
    onClose: () => void;
    content: PolicyModalDict;
    closeLabel: string;
    fill: (s: string) => string;
}) {
    // Portal target only exists after mount (SSR has no `document`).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    // Escape-to-close + scroll lock while the modal is open. The frontend
    // reserves the scrollbar gutter permanently (`scrollbar-gutter: stable`),
    // so hiding overflow here never shifts the page layout sideways.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
        };
    }, [open, onClose]);

    if (!mounted) return null;

    // Portalled to <body> so it escapes the sticky booking-card stacking
    // context and covers the whole viewport (navbar included).
    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    className='fixed inset-0 z-[200] flex items-center justify-center p-4'
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}>
                    {/* Overlay */}
                    <div
                        className='absolute inset-0 bg-black/30'
                        onClick={onClose}
                        aria-hidden='true'
                    />

                    {/* Panel */}
                    <motion.div
                        role='dialog'
                        aria-modal='true'
                        aria-label={fill(content.title)}
                        initial={{ opacity: 0, scale: 0.97, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 12 }}
                        transition={{
                            duration: 0.22,
                            ease: [0.21, 0.47, 0.32, 0.98],
                        }}
                        className='relative flex max-h-[90vh] w-full max-w-[875px] flex-col gap-6 overflow-y-auto rounded-[16px] border-[0.6px] border-it-ink/10 bg-it-white p-5 sm:gap-10 sm:p-6'>
                        {/* Close button (pill, top-right) */}
                        <motion.button
                            type='button'
                            aria-label={closeLabel}
                            onClick={onClose}
                            whileTap={{ scale: 0.9 }}
                            transition={springPop}
                            className='absolute top-5 right-5 z-10 grid size-10 cursor-pointer place-items-center rounded-it-full border border-it-ink/10 bg-it-surface transition-colors duration-300 hover:bg-it-border sm:top-6 sm:right-6 sm:size-12'>
                            <Image
                                src='/icons/modal-close.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-6 shrink-0'
                            />
                        </motion.button>

                        {/* Header: title + divider */}
                        <div className='flex flex-col gap-4'>
                            <h2 className='m-0 pr-12 font-medium text-[20px] leading-[30px] tracking-[-0.3px] text-it-heading sm:pr-14 sm:text-[32px] sm:leading-[38px] sm:tracking-[-0.38px]'>
                                {fill(content.title)}
                            </h2>
                            <div className='h-px w-full bg-it-ink/10' />
                        </div>

                        {/* Body */}
                        <div className='flex flex-col gap-5 sm:gap-6'>
                            <div className='flex flex-col gap-1'>
                                <span className='font-medium text-[16px] sm:text-[18px] leading-[29px] tracking-[-0.22px] text-it-heading'>
                                    {fill(content.introTitle)}
                                </span>
                                <p className='m-0 text-[14px] sm:text-[16px] leading-[26px] tracking-[-0.19px] text-it-heading'>
                                    {fill(content.introBody)}
                                </p>
                            </div>

                            {/* Orange "HOW IT WORKS" box (5% primary tint) */}
                            <div className='flex flex-col gap-2 rounded-[8px] border-[0.6px] border-it-primary/20 bg-it-primary/5 p-4'>
                                <span className='font-medium text-[16px] sm:text-[18px] leading-[29px] tracking-[-0.22px] text-[#8b390e]'>
                                    {fill(content.stepsTitle)}
                                </span>
                                <ol className='m-0 flex list-none flex-col gap-1 p-0'>
                                    {content.steps.map((step, i) => (
                                        <li
                                            key={i}
                                            className='flex gap-1.5 text-[14px] sm:text-[16px] leading-[26px] tracking-[-0.19px] text-[#8b390e]'>
                                            <span>{i + 1}.</span>
                                            <span>{fill(step)}</span>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {/* Closing block */}
                            <div className='flex flex-col gap-4'>
                                <span className='font-medium text-[16px] sm:text-[18px] leading-[29px] tracking-[-0.22px] text-it-heading'>
                                    {fill(content.outroTitle)}
                                </span>
                                <p className='m-0 text-[14px] sm:text-[16px] leading-[26px] tracking-[-0.19px] text-it-heading'>
                                    {fill(content.outroBody)}
                                </p>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
