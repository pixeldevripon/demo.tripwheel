'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type ReactNode } from 'react';
import { COLLAPSE_EASE } from './lib/booking.utils';

/**
 * Smoothly animates its children open/closed by height + fade (framer-motion).
 * Used for every collapsible region in the booking card.
 *
 * It clips **only while the height is moving**. `overflow-hidden` is what stops
 * the content spilling out during the tween, but left on at rest it also clips
 * what the children do in place: `springPop` is underdamped (stiffness 500,
 * damping 30 → ζ ≈ 0.67), so releasing a tap overshoots past scale 1 and the
 * bottom border of a departure chip was being sliced off against the box that
 * hugs it. Focus rings and shadows had the same problem, quietly.
 *
 * So the clip is lifted once the open animation settles, and put back the
 * moment `open` goes false - before the exit tween starts, which is the only
 * time it is needed again.
 */
export function Collapse({
    open,
    children,
}: {
    open: boolean;
    children: ReactNode;
}) {
    const [settled, setSettled] = useState(false);
    useEffect(() => {
        if (!open) setSettled(false);
    }, [open]);

    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    key='content'
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: COLLAPSE_EASE }}
                    onAnimationComplete={() => setSettled(true)}
                    className={settled ? undefined : 'overflow-hidden'}>
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
