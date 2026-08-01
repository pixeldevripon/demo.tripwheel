'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

/**
 * True below Tailwind's `sm` breakpoint (640px). Starts `false` (matching the
 * SSR output) and flips after hydration - list items animate-skip only once
 * the client knows it's a phone, so there is no hydration mismatch.
 */
export function useIsMobile() {
    const [isMobile, setIsMobile] = React.useState(false);
    React.useEffect(() => {
        const mq = window.matchMedia('(max-width: 639px)');
        setIsMobile(mq.matches);
        const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
        mq.addEventListener('change', onChange);
        return () => mq.removeEventListener('change', onChange);
    }, []);
    return isMobile;
}

/**
 * False during SSR and the hydration render, true for every component that
 * mounts AFTER the first client effect ran (client navigations, streamed
 * Suspense content).
 *
 * Why: framer's `initial={{ opacity: 0 }}` is serialized into the server HTML
 * as an inline style, so everything below the hero renders INVISIBLE until the
 * JS bundle arrives and hydrates - on a slow connection that reads as a blank
 * page (and it is what search engines paint). First-paint content therefore
 * renders visible with no entrance (the sitewide "static shell → no mount
 * animation" rule), and only post-hydration mounts animate.
 */
let pageHydrated = false;

function useMountedAfterHydration() {
    const [mountedAfterHydration] = React.useState(() => pageHydrated);
    React.useEffect(() => {
        pageHydrated = true;
    }, []);
    return mountedAfterHydration;
}

interface RevealProps {
    children: React.ReactNode;
    /** Wrapper width - '100%' (default), shrink to content, or 'auto' to set
     *  NO inline width so `className` fully controls sizing (grid cells,
     *  fixed-width scroller items). */
    width?: 'fit-content' | '100%' | 'auto';
    /** Delay before the reveal starts (seconds) - use for staggering siblings */
    delay?: number;
    /** Animation duration (seconds) */
    duration?: number;
    /** Vertical travel distance in px (set 0 for a pure fade) */
    yOffset?: number;
    /** Animate only the first time it enters the viewport */
    once?: boolean;
    /** Fraction of the element that must be visible to trigger (0–1) */
    amount?: number;
    /** IntersectionObserver root margin - negative values trigger a little earlier */
    margin?: string;
    /** Mark a repeated child rendered from a `.map()` (list/grid cells).
     *  On mobile the wrapper renders a plain div - no per-item animation.
     *  List items share the same delay (never increment it by index). */
    listItem?: boolean;
    className?: string;
}

/**
 * Reusable scroll-reveal wrapper.
 *
 * Fades + lifts its children as they scroll into view. Respects
 * `prefers-reduced-motion` (renders statically). Wrap any block:
 *
 * ```tsx
 * <Reveal><h2>Title</h2></Reveal>
 * <Reveal delay={0.1}>…second item, staggered…</Reveal>
 * ```
 */
export const Reveal = ({
    children,
    width = '100%',
    delay = 0.2,
    duration = 0.6,
    yOffset = 40,
    once = true,
    amount,
    margin = '-50px',
    listItem = false,
    className,
}: RevealProps) => {
    const reduceMotion = useReducedMotion();
    const isMobile = useIsMobile();
    const animateEntrance = useMountedAfterHydration();

    // List/grid cells on phones render statically - a column of individually
    // fading cards reads as jank there, and delayed items waste scroll time.
    if (listItem && isMobile) {
        return (
            <div
                className={className}
                style={width === 'auto' ? undefined : { width }}>
                {children}
            </div>
        );
    }

    return (
        <motion.div
            initial={
                reduceMotion || !animateEntrance
                    ? false
                    : { opacity: 0, y: yOffset }
            }
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once, amount, margin }}
            transition={{
                duration,
                delay,
                ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className={className}
            style={width === 'auto' ? undefined : { width }}>
            {children}
        </motion.div>
    );
};
