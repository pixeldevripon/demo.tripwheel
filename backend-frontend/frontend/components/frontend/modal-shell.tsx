'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Everything inside a modal that can take focus, for the Tab trap. */
const FOCUSABLE =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * The one modal chrome of the public site: portal to <body>, dimmed overlay,
 * a panel that is a bottom sheet on phones (80dvh, rounded on top, square
 * where it meets the screen) and a centred card on sm+, with escape-to-close,
 * scroll lock, a Tab focus trap and focus restore to the trigger.
 *
 * Extracted from `PolicyModal` when the checkout's operator-conditions reader
 * needed the identical shell (code review: ~90 lines of accessibility-critical
 * logic must not live in two places). Consumers own everything INSIDE the
 * panel - header, body, footer - and pass size overrides via `panelClassName`.
 *
 * `dvh`, not `vh`: on mobile browsers `vh` is measured with the URL bar
 * expanded, so a `vh` sheet sits taller than the visible area on exactly the
 * devices the sheet is for. The frontend reserves the scrollbar gutter
 * permanently (`scrollbar-gutter: stable`), so the scroll lock never shifts
 * the page sideways.
 */
export function ModalShell({
    open,
    onClose,
    ariaLabel,
    panelClassName = 'sm:max-h-[90vh] sm:max-w-[875px] sm:gap-6',
    children,
}: {
    open: boolean;
    onClose: () => void;
    ariaLabel: string;
    /** Size/spacing overrides appended to the shared panel classes. */
    panelClassName?: string;
    children: ReactNode;
}) {
    // Portal target only exists after mount (SSR has no `document`).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const panelRef = useRef<HTMLDivElement>(null);
    /** The trigger, so focus can go back where it came from on close. */
    const triggerRef = useRef<HTMLElement | null>(null);

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
            // when the whole page unmounts on navigation, and focusing a
            // detached node there would yank focus off the incoming page.
            const trigger = triggerRef.current;
            if (trigger?.isConnected) trigger.focus();
        };
    }, [open, onClose, mounted]);

    if (!mounted) return null;

    // Portalled to <body> so it escapes any sticky-container stacking context
    // and covers the whole viewport (navbar included).
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
                        aria-label={ariaLabel}
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
                        className={`relative flex h-[80dvh] w-full flex-col gap-5 overflow-hidden rounded-t-[16px] rounded-b-none border-[0.6px] border-it-ink/10 bg-it-white p-5 shadow-it-lg outline-none sm:h-auto sm:rounded-[16px] sm:p-6 ${panelClassName}`}>
                        {children}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
