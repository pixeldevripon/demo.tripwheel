'use client';

import { StepNumberBadge } from '@/components/frontend/step-number-badge';
import { springPop } from '@/lib/motion';
import type { PolicyModalDict } from '@/lib/tours/booking';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

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
 * Fully self-contained: it owns its portal mount, escape-to-close, scroll lock,
 * focus trap and focus restore; the caller only toggles `open` and supplies the
 * copy.
 */

/** Sub-heading: lead sentence, "HOW IT WORKS", and the closing heading. */
const SUBHEAD = 'font-bold text-[14.5px] leading-[1.6] tracking-[-0.005em]';
/** Body copy under a sub-heading. */
const BODY = 'text-[14.5px] leading-[1.68]';

/** Everything inside a modal that can take focus, for the Tab trap. */
const FOCUSABLE =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

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

    const panelRef = useRef<HTMLDivElement>(null);
    /** The trigger, so focus can go back where it came from on close. */
    const triggerRef = useRef<HTMLElement | null>(null);

    // Escape, scroll lock, focus trap and focus restore. The frontend reserves
    // the scrollbar gutter permanently (`scrollbar-gutter: stable`), so hiding
    // overflow here never shifts the page layout sideways.
    useEffect(() => {
        // `mounted` is a REAL dependency, not noise. The portal renders nothing
        // on the first pass (SSR has no `document`), so on that pass
        // `panelRef.current` is null and the focus move below silently does
        // nothing. Without `mounted` here the effect never re-runs once the
        // portal exists, and focus stays on <body> - the trap looks present in
        // the source and is absent in the browser.
        if (!open || !mounted) return;

        triggerRef.current = document.activeElement as HTMLElement | null;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        // Move focus INTO the dialog, or the next Tab continues from the
        // trigger and walks the page behind the overlay.
        panelRef.current?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
                return;
            }
            if (e.key !== 'Tab') return;
            const panel = panelRef.current;
            if (!panel) return;
            const items = Array.from(
                panel.querySelectorAll<HTMLElement>(FOCUSABLE)
            );
            // Nothing tabbable but the panel itself - keep focus put rather
            // than letting Tab escape to the page underneath.
            if (items.length === 0) {
                e.preventDefault();
                return;
            }
            const first = items[0];
            const last = items[items.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        };

        window.addEventListener('keydown', onKey);
        return () => {
            window.removeEventListener('keydown', onKey);
            document.body.style.overflow = prevOverflow;
            // Only if the trigger is still on the page: this cleanup also runs
            // when the whole tour page unmounts on navigation, and focusing a
            // detached node there would yank focus off the incoming page.
            const trigger = triggerRef.current;
            if (trigger?.isConnected) trigger.focus();
        };
    }, [open, onClose, mounted]);

    if (!mounted) return null;

    // Portalled to <body> so it escapes the sticky booking-card stacking
    // context and covers the whole viewport (navbar included).
    return createPortal(
        <AnimatePresence>
            {open && (
                <motion.div
                    // Phone: the panel is a bottom sheet, so the flex box
                    // pins it to the bottom edge. sm+: a padded, centred box.
                    className='fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4'
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
                        ref={panelRef}
                        role='dialog'
                        aria-modal='true'
                        aria-label={fill(content.title)}
                        // Focusable so the dialog itself can hold focus on open
                        // without stealing a tab stop from the page.
                        tabIndex={-1}
                        initial={{ opacity: 0, scale: 0.97, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.97, y: 12 }}
                        transition={{
                            duration: 0.22,
                            ease: [0.21, 0.47, 0.32, 0.98],
                        }}
                        // Phone: an 80%-height sheet rising from the bottom
                        // edge - rounded on top, square where it meets the
                        // screen, scrolling internally. The 20% of page left
                        // visible above it is what makes it read as a sheet
                        // over the tour rather than a new screen, and it keeps
                        // the backdrop tappable to dismiss.
                        //
                        // `dvh`, not `vh`: on mobile browsers `vh` is measured
                        // with the URL bar expanded, so the sheet would sit
                        // taller than the visible area on exactly the devices
                        // this is for.
                        //
                        // sm+: the centred card. `shadow-it-lg` is the soft
                        // shadow the rest of the page uses, and the reason this
                        // stopped reading as flat.
                        className='relative flex h-[80dvh] w-full flex-col gap-5 overflow-hidden rounded-t-[16px] rounded-b-none border-[0.6px] border-it-ink/10 bg-it-white p-5 shadow-it-lg outline-none sm:h-auto sm:max-h-[90vh] sm:max-w-[875px] sm:gap-6 sm:rounded-[16px] sm:p-6'>
                        {/* Header - does NOT scroll.
                            The close button used to be `absolute` inside the
                            panel while the panel itself was the scroll
                            container, so on a modal long enough to scroll (the
                            deposit one is) it slid off the top and left no way
                            out but Esc or the backdrop. It is a flex sibling of
                            the title now, which also retires the `pr-12` /
                            `size-12` clearance guess - those two numbers
                            disagreed, so the title could run under the button
                            at some widths. */}
                        <div className='flex shrink-0 flex-col gap-4'>
                            <div className='flex items-start justify-between gap-4'>
                                <h2 className='m-0 font-it-display text-[21px] font-bold leading-[1.2] tracking-[-0.012em] text-it-heading sm:text-[24px]'>
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
                                <span className={`${SUBHEAD} text-it-ink`}>
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
                                                className={`${BODY} pt-1 text-it-ink`}>
                                                {fill(step)}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </div>

                            {/* Closing block */}
                            <div className='flex flex-col gap-1.5'>
                                <span className={`${SUBHEAD} text-it-ink`}>
                                    {fill(content.outroTitle)}
                                </span>
                                <p className={`m-0 ${BODY} text-it-text-muted`}>
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
