'use client';

import { animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { useLayoutEffect, useRef, useState } from 'react';
import { springPop } from '@/lib/motion';

/**
 * Read-more paragraph for the "About" sections - their only interactive
 * portion, isolated as the shared client leaf (STRONG RULE: the section shells
 * stay server components).
 *
 * It clamps by LINES, not by sentences. It used to split the copy in half by
 * sentence count and show the first half, which meant what a reader saw was
 * decided by how the copy happened to be punctuated: a three-sentence
 * description collapsed to one line and asked them to press "Learn more" to see
 * the second, while an eight-sentence one showed a wall. Four lines is a
 * paragraph worth reading before deciding (founder, 2026-08-18).
 *
 * The toggle only appears when the text ACTUALLY overflows the clamp, measured
 * after layout - so a short description renders whole with no control at all,
 * instead of a "Learn more" that reveals half a sentence.
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
    clampLines = 4,
}: {
    description: string;
    moreLabel: string;
    lessLabel: string;
    /** Paragraph classes (typography differs per section). */
    className: string;
    /** Toggle-button classes (typography differs per section). */
    buttonClassName: string;
    /** Lines shown while collapsed. */
    clampLines?: number;
}) {
    const [expanded, setExpanded] = useState(false);
    // Whether the copy is long enough to need a toggle at all. Measured once
    // collapsed; deliberately NOT recomputed while expanded, where the clamp is
    // off and the answer would always come back false.
    const [overflows, setOverflows] = useState(false);
    const reduceMotion = useReducedMotion();

    const innerRef = useRef<HTMLDivElement | null>(null);
    const textRef = useRef<HTMLParagraphElement | null>(null);
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

    // Does the copy exceed the clamp? Re-checked on resize, because the answer
    // is a function of the column width - the same paragraph needs a toggle on
    // a phone and none on a wide screen.
    useLayoutEffect(() => {
        if (expanded) return;
        const el = textRef.current;
        if (!el) return;
        const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
        check();
        const ro = new ResizeObserver(check);
        ro.observe(el);
        return () => ro.disconnect();
    }, [expanded, description, clampLines]);

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

    return (
        <motion.div style={{ height }} className='overflow-hidden'>
            <div ref={innerRef}>
                {/* The FULL text is always in the DOM - the clamp is visual
                    only. That keeps it findable by in-page search and readable
                    by a crawler, which a "first half of the sentences" split
                    could never claim. */}
                <p
                    ref={textRef}
                    className={className}
                    style={
                        expanded
                            ? undefined
                            : {
                                  display: '-webkit-box',
                                  WebkitBoxOrient: 'vertical',
                                  WebkitLineClamp: clampLines,
                                  overflow: 'hidden',
                              }
                    }>
                    {description}
                </p>
                {overflows && (
                    <motion.button
                        type='button'
                        onClick={toggle}
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className={buttonClassName}>
                        {expanded ? lessLabel : moreLabel}
                    </motion.button>
                )}
            </div>
        </motion.div>
    );
}
