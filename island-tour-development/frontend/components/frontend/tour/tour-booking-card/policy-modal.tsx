'use client';

import { ModalShell } from '@/components/frontend/modal-shell';
import { StepNumberBadge } from '@/components/frontend/step-number-badge';
import { springPop } from '@/lib/motion';
import type { PolicyModalDict } from '@/lib/tours/booking';
import { motion } from 'framer-motion';
import Image from 'next/image';

/**
 * Policy detail modal (Figma "Free cancellation" 48125:20233 / "Pay later"
 * 48125:21537). Both share one shell - a rounded card with a soft shadow, a
 * display title over a divider, a lead-in block, a tinted "HOW IT WORKS" box
 * with numbered steps, and a closing block - so a single component renders
 * either via its `content`. `fill` interpolates the `{hours}` / `{pct}`
 * placeholders from the live tour data.
 *
 * TYPOGRAPHY IS THE PAGE'S, NOT THE MODAL'S OWN (Pastel #43). This used to
 * carry bespoke Figma pixel values - 16/18px bodies on 29px leading with
 * -0.22px tracking - which is why it read as plain and foreign next to the tour
 * content beside it. It now uses the same scale as `TourSection` and the What
 * to expect timeline: a display h2, 14.5px copy, 1.6/1.68 leading. Keep it that
 * way; a modal that invents its own type scale is exactly the complaint.
 *
 * The portal / escape / scroll-lock / focus-trap chrome lives in the shared
 * `ModalShell` (also used by the checkout's operator-conditions reader); this
 * component owns only its content.
 */

/** Sub-heading: lead sentence, "HOW IT WORKS", and the closing heading. */
const SUBHEAD = 'text-[13px] md:text-[14.5px] leading-[1.6] tracking-[-0.012em]';
/** Body copy under a sub-heading. */
const BODY = 'text-[13.5px] leading-[1.7] tracking-[-0.012em]';

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
    return (
        <ModalShell
            open={open}
            onClose={onClose}
            ariaLabel={fill(content.title)}
            panelClassName='sm:max-h-[90vh] sm:max-w-[875px] sm:gap-6'>
            {/* Header - does NOT scroll.
                The close button used to be `absolute` inside the panel while
                the panel itself was the scroll container, so on a modal long
                enough to scroll (the deposit one is) it slid off the top and
                left no way out but Esc or the backdrop. It is a flex sibling
                of the title now. */}
            <div className='flex shrink-0 flex-col gap-4'>
                <div className='flex items-start justify-between gap-4'>
                    <h2 className='m-0 font-it-display text-[19px] leading-[1.2] tracking-[-0.012em] text-it-heading sm:text-[21px] font-medium'>
                        {fill(content.title)}
                    </h2>
                    <motion.button
                        type='button'
                        aria-label={closeLabel}
                        onClick={onClose}
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className='-mt-0.5 grid size-9 shrink-0 cursor-pointer place-items-center rounded-it-full border border-it-ink/10 bg-it-surface transition-colors duration-300 hover:bg-it-border sm:size-10'>
                        <Image
                            src='/icons/modal-close.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-4 shrink-0 sm:size-[18px]'
                        />
                    </motion.button>
                </div>
                <div className='h-px w-full bg-it-ink/10' />
            </div>

                        {/* Body */}
                        <div className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto sm:gap-6'>
                            <div className='flex flex-col gap-1.5'>
                                <span className={`${SUBHEAD} text-it-heading`}>
                                    {fill(content.introTitle)}
                                </span>
                                <p className={`m-0 ${BODY} text-it-text-muted`}>
                                    {fill(content.introBody)}
                                </p>
                            </div>

                            {/* "HOW IT WORKS" box (5% primary tint) */}
                            <div className='flex flex-col gap-3 rounded-[8px] border-[0.6px] border-it-primary/20 bg-it-primary/5 p-4'>
                                <span
                                    className={`${SUBHEAD} text-it-primary-hover`}>
                                    {fill(content.stepsTitle)}
                                </span>
                                <ol className='m-0 flex list-none flex-col gap-2.5 p-0'>
                                    {content.steps.map((step, i) => (
                                        <li
                                            key={i}
                                            className='flex items-start gap-3'>
                                            <StepNumberBadge step={i + 1} />
                                            <span
                                                className={`${BODY} pt-1 text-it-heading`}>
                                                {fill(step)}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                {/* Closing block */}
                <div className='flex flex-col gap-1.5 text-[13px] sm:text-[14.5px] text-[#8b390e] leading-[26px] tracking-[-0.19px]'>
                    <span className={`${SUBHEAD} text-it-heading`}>
                        {fill(content.outroTitle)}
                    </span>
                    <p className={`m-0 ${BODY} text-it-text-muted`}>
                        {fill(content.outroBody)}
                    </p>
                </div>
            </div>
        </ModalShell>
    );
}
