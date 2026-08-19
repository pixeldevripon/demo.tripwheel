'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

/**
 * Scroll-triggered fade + lift for marketing sections. Fires once when the
 * element enters the viewport; respects `prefers-reduced-motion`. Siblings
 * stagger via `delay`.
 */
export function Reveal({
    children,
    delay = 0,
    y = 28,
    className,
}: {
    children: ReactNode;
    /** Seconds before the animation starts - use to stagger siblings. */
    delay?: number;
    /** Vertical travel in px (0 for a pure fade). */
    y?: number;
    className?: string;
}) {
    const reduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-64px' }}
            transition={{
                duration: 0.7,
                delay,
                ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className={className}>
            {children}
        </motion.div>
    );
}
