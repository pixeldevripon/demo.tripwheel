'use client';

import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { Calendar } from '@/components/ui/calendar';
import { springPop } from '@/lib/motion';

/**
 * The mobile full-screen search layer (Pastel #57).
 *
 * TWO COMPLAINTS MADE THIS, and both are about being stuck. The suggestions
 * panel opened inline under the bar and filled nearly the whole screen with no
 * control anywhere to close it, so tapping outside barely worked and anyone who
 * opened it by accident was trapped. And the keyboard covered it: about two and
 * a half rows were visible and everything after that was unreachable.
 *
 * So the layer owns the full height, and the list scrolls INSIDE it - the
 * keyboard shortens the scroll area instead of hiding rows behind itself.
 *
 * THE WHOLE PILL COMES IN, not just the activity field. "What?" and "When?" stay
 * side by side, so the date is one tap away at any moment and no second search
 * bar is left behind on the page underneath.
 *
 * THE CLOSE ✕ SITS OUTSIDE THE PILL, on its left. An ✕ inside a search field
 * reads as "clear what I typed", not "close this" - the client called that out
 * specifically, so any clear-the-field affordance stays separate (the date's own
 * clear button lives inside the pill and means only that).
 */
export function MobileSearchLayer({
    open,
    onClose,
    closeLabel,
    /** The pill, mounted by the caller so the layer holds no search state. */
    pill,
    /** The suggestions panel - the SAME `SearchTypeahead` every surface uses. */
    panel,
    /** Shown instead of `panel` once the date field is tapped. */
    calendarOpen,
    date,
    onDateSelect,
}: {
    open: boolean;
    onClose: () => void;
    closeLabel: string;
    pill: ReactNode;
    panel: ReactNode;
    calendarOpen?: boolean;
    date?: Date;
    onDateSelect?: (date: Date | undefined) => void;
}) {
    const scrollY = useRef(0);

    /*
     * Lock the page behind the layer and RESTORE THE EXACT SCROLL POSITION on
     * close - an explicit acceptance criterion, and the reason this is
     * `position: fixed` on the body rather than `overflow: hidden`. Plain
     * `overflow: hidden` does not stop iOS Safari scrolling the page under a
     * fixed overlay, and closing then leaves the visitor somewhere else on a
     * long destination page than where they opened the search.
     */
    useEffect(() => {
        if (!open) return;
        scrollY.current = window.scrollY;
        const { body } = document;
        const prev = {
            position: body.style.position,
            top: body.style.top,
            width: body.style.width,
        };
        body.style.position = 'fixed';
        body.style.top = `-${scrollY.current}px`;
        body.style.width = '100%';
        return () => {
            body.style.position = prev.position;
            body.style.top = prev.top;
            body.style.width = prev.width;
            // `instant`: an animated scroll here races the closing layer and
            // lands the visitor mid-flight.
            window.scrollTo({ top: scrollY.current, behavior: 'instant' });
        };
    }, [open]);

    // Escape closes it too - a hardware keyboard on a tablet is still mobile
    // width, and the layer must never be a one-way door.
    useEffect(() => {
        if (!open) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            role='dialog'
            aria-modal='true'
            aria-label={closeLabel}
            // `dvh`, not `vh`: the mobile URL bar collapses on scroll and `vh`
            // leaves the last row of the list under the fold for good.
            className='fixed inset-0 z-100 flex h-[100dvh] flex-col bg-it-white md:hidden'>
            {/* Bar row: close ✕ OUTSIDE the pill, on its left. */}
            <div className='flex shrink-0 items-center gap-2 border-b border-it-divider px-2.5 py-1.5'>
                <motion.button
                    type='button'
                    onClick={onClose}
                    aria-label={closeLabel}
                    whileTap={{ scale: 0.9 }}
                    transition={springPop}
                    className='grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-full border-none bg-transparent text-it-heading tracking-[-0.012em]'>
                    <X size={18} strokeWidth={2} />
                </motion.button>
                <div className='min-w-0 flex-1'>{pill}</div>
            </div>

            {/* The only scroller. `overscroll-contain` stops a flick at the end
                of the list from scrolling the frozen page behind it. */}
            <div className='min-h-0 flex-1 overflow-y-auto overscroll-contain'>
                {calendarOpen ? (
                    /*
                     * FULL WIDTH, and sized for a thumb. The shared calendar
                     * defaults to a 32px cell, which is right inside a desktop
                     * popover and wrong here: on a full screen it rendered as a
                     * small grid of small numbers floating in the middle of an
                     * otherwise empty sheet, and 32px is under the 44px touch
                     * target every other control on this page meets.
                     */
                    <div className='px-3 py-3'>
                        <Calendar
                            mode='single'
                            selected={date}
                            onSelect={onDateSelect}
                            disabled={{ before: new Date() }}
                            autoFocus
                            className='w-full bg-it-white p-0 text-[14px] [--cell-radius:8px] [--cell-size:--spacing(11)] tracking-[-0.012em]'
                            classNames={{
                                weekday:
                                    'flex-1 text-[12px] font-medium text-it-text-muted select-none tracking-[-0.012em]',
                                caption_label:
                                    'text-[14.5px] font-medium text-it-heading tracking-[-0.012em]',
                            }}
                        />
                    </div>
                ) : (
                    panel
                )}
            </div>
        </motion.div>,
        document.body
    );
}
