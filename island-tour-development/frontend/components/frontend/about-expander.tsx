'use client';

import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { springPop } from '@/lib/motion';

/**
 * Sentence-halves read-more paragraph for the "About" sections - their only
 * interactive portion, isolated as the shared client leaf (STRONG RULE: the
 * section shells stay server components).
 *
 * Classic, minimal height-auto mechanic, flicker-free BOTH directions:
 * 1. On toggle, the wrapper's height is PINNED to its current pixel value
 *    (via a motion value, synchronously - before the text swaps), so the
 *    content change can never snap the layout.
 * 2. After the swap renders, the height animates to the newly measured target.
 * 3. On completion it releases back to 'auto', so window reflows at rest
 *    never clip the text.
 */
export function AboutExpander({
    description,
    moreLabel,
    lessLabel,
    className,
    buttonClassName,
}: {
    description: string;
    moreLabel: string;
    lessLabel: string;
    /** Paragraph classes (typography differs per section). */
    className: string;
    /** Toggle-button classes (typography differs per section). */
    buttonClassName: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const reduceMotion = useReducedMotion();

    const innerRef = useRef<HTMLDivElement | null>(null);
    // 'auto' at rest; a pixel value only while a toggle is animating.
    const height = useMotionValue<number | 'auto'>('auto');
    const pending = useRef(false);

    function toggle() {
        const el = innerRef.current;
        if (el) {
            height.set(el.offsetHeight);
            pending.current = true;
        }
        setExpanded(v => !v);
    }

    // Runs after the swapped content is in the DOM (still clamped at the old
    // height): tween to the new measured height, then release to 'auto'.
    useLayoutEffect(() => {
        const el = innerRef.current;
        if (!el || !pending.current) return;
        pending.current = false;
        if (reduceMotion) {
            height.set('auto');
            return;
        }
        const controls = animate(height, el.offsetHeight, {
            duration: 0.4,
            ease: [0.22, 1, 0.36, 1],
            onComplete: () => height.set('auto'),
        });
        return () => controls.stop();
    }, [expanded, height, reduceMotion]);

    const parts = description.split('. ');
    const midpoint = Math.ceil(parts.length / 2);
    const first = parts.slice(0, midpoint).join('. ');
    const second = parts.slice(midpoint).join('. ').replace(/\.*$/, '.');
    const hasMore = second.trim().length > 1;

    return (
        <motion.div style={{ height }} className='overflow-hidden'>
            <div ref={innerRef}>
                <p className={className}>
                    <span>
                        {first}
                        {hasMore && !expanded ? '...' : '.'}
                    </span>
                    {expanded && hasMore && (
                        <motion.span
                            initial={reduceMotion ? false : { opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className='inline'>
                            {' '}
                            {second}
                        </motion.span>
                    )}
                    {hasMore && (
                        <motion.button
                            type='button'
                            onClick={toggle}
                            whileTap={{ scale: 0.98 }}
                            transition={springPop}
                            className={buttonClassName}>
                            {expanded ? lessLabel : moreLabel}
                        </motion.button>
                    )}
                </p>
            </div>
        </motion.div>
    );
}
