'use client';

import { AnimatePresence, motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { COLLAPSE_EASE } from './lib/booking.utils';

/**
 * Smoothly animates its children open/closed by height + fade (framer-motion).
 * `overflow-hidden` clips the content while the height tween runs so nothing
 * jumps. Used for every collapsible region in the booking card.
 */
export function Collapse({
    open,
    children,
}: {
    open: boolean;
    children: ReactNode;
}) {
    return (
        <AnimatePresence initial={false}>
            {open && (
                <motion.div
                    key='content'
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: COLLAPSE_EASE }}
                    className='overflow-hidden'>
                    {children}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
