'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { useIsMobile } from './reveal';

/**
 * Mount-based fade + lift - for content that arrives via Suspense streaming.
 *
 * Unlike <Reveal> (which triggers on scroll via `whileInView`), this animates on
 * MOUNT. Streamed sections are inserted after the initial paint, often already
 * inside the viewport, where an IntersectionObserver-based reveal can miss its
 * trigger and leave the content stuck invisible (the same blank-section bug the
 * destination hero hit). A mount animation always fires. Respects
 * `prefers-reduced-motion`.
 */
export function MountReveal({
    children,
    delay = 0,
    duration = 0.6,
    yOffset = 20,
    listItem = false,
    className,
}: {
    children: ReactNode;
    /** Delay before the animation starts (seconds) - use to stagger siblings. */
    delay?: number;
    /** Animation duration (seconds). */
    duration?: number;
    /** Vertical travel distance in px (set 0 for a pure fade). */
    yOffset?: number;
    /** Mark a repeated child rendered from a `.map()` (list/grid cells).
     *  On mobile the wrapper renders a plain div - no per-item animation.
     *  List items share the same delay (never increment it by index). */
    listItem?: boolean;
    className?: string;
}) {
    const reduceMotion = useReducedMotion();
    const isMobile = useIsMobile();

    // List/grid cells on phones render statically (same rule as <Reveal>).
    if (listItem && isMobile) {
        return <div className={className}>{children}</div>;
    }

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: yOffset }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration, delay, ease: [0.21, 0.47, 0.32, 0.98] }}
            className={className}>
            {children}
        </motion.div>
    );
}
