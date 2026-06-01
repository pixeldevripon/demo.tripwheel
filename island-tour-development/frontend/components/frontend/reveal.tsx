'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface RevealProps {
    children: React.ReactNode;
    /** Wrapper width — '100%' (default) or shrink to content */
    width?: 'fit-content' | '100%';
    /** Delay before the reveal starts (seconds) — use for staggering siblings */
    delay?: number;
    /** Animation duration (seconds) */
    duration?: number;
    /** Vertical travel distance in px (set 0 for a pure fade) */
    yOffset?: number;
    /** Animate only the first time it enters the viewport */
    once?: boolean;
    /** Fraction of the element that must be visible to trigger (0–1) */
    amount?: number;
    /** IntersectionObserver root margin — negative values trigger a little earlier */
    margin?: string;
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
    className,
}: RevealProps) => {
    const reduceMotion = useReducedMotion();

    return (
        <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: yOffset }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once, amount, margin }}
            transition={{
                duration,
                delay,
                ease: [0.21, 0.47, 0.32, 0.98],
            }}
            className={className}
            style={{ width }}>
            {children}
        </motion.div>
    );
};

/**
 * Reveals a list of children with a staggered delay between each.
 *
 * ```tsx
 * <RevealList staggerDelay={0.1}>
 *   {items.map((i) => <Card key={i.id} {...i} />)}
 * </RevealList>
 * ```
 */
export const RevealList = ({
    children,
    delay = 0.1,
    staggerDelay = 0.1,
}: {
    children: React.ReactNode[];
    delay?: number;
    staggerDelay?: number;
}) => {
    return (
        <>
            {React.Children.map(children, (child, index) => (
                <Reveal delay={delay + index * staggerDelay} key={index}>
                    {child}
                </Reveal>
            ))}
        </>
    );
};
