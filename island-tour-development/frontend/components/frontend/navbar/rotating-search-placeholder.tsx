'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

const ROTATE_MS = 2800;

/**
 * Fever-style animated placeholder: the static "Search for" prefix plus the
 * active destination's category names, each sliding up on a timer. Rendered as
 * a pointer-events-none overlay on top of the (empty) input - the caller
 * blanks the real placeholder attribute while names are available. Paused for
 * reduced-motion users (the first name shows statically).
 */
export function RotatingSearchPlaceholder({
    prefix,
    names,
}: {
    prefix: string;
    names: string[];
}) {
    const reduceMotion = useReducedMotion();
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (reduceMotion || names.length < 2) return;
        const timer = setInterval(
            () => setIndex(i => (i + 1) % names.length),
            ROTATE_MS
        );
        return () => clearInterval(timer);
    }, [names.length, reduceMotion]);

    const name = names[index % names.length];

    return (
        <span
            aria-hidden='true'
            className='pointer-events-none absolute inset-0 flex items-center gap-1.5 overflow-hidden text-base text-it-text-muted'>
            <span className='shrink-0'>{prefix}</span>
            <span className='relative min-w-0 flex-1 self-stretch overflow-hidden'>
                <AnimatePresence initial={false} mode='popLayout'>
                    <motion.span
                        key={name}
                        initial={
                            reduceMotion ? false : { y: '100%', opacity: 0 }
                        }
                        animate={{ y: '0%', opacity: 1 }}
                        exit={
                            reduceMotion
                                ? undefined
                                : { y: '-100%', opacity: 0 }
                        }
                        transition={{
                            // Gentle expo-out over a longer window - the incoming
                            // and outgoing names glide past each other instead of
                            // snapping (popLayout runs both concurrently).
                            duration: 0.7,
                            ease: [0.19, 1, 0.22, 1],
                            opacity: { duration: 0.45, ease: 'easeOut' },
                        }}
                        className='absolute inset-0 flex items-center truncate'>
                        {name}
                    </motion.span>
                </AnimatePresence>
            </span>
        </span>
    );
}
