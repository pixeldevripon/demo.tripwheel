'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { springPop } from '@/lib/motion';

/**
 * Generic "truncate + Read More / Read less" text block. A single client leaf
 * usable anywhere (review cards, editorial blurbs, card descriptions, ...): long
 * copy is truncated to an excerpt with an inline toggle appended right after it;
 * short copy renders in full with no toggle.
 *
 * Typography is caller-controlled via `className` (the wrapping paragraph) and
 * `buttonClassName`; both fall back to the platform's body + primary-link styles.
 */
export function ExpandableText({
    text,
    moreLabel,
    lessLabel,
    limit = 160,
    className,
    buttonClassName,
}: {
    text: string;
    moreLabel: string;
    lessLabel: string;
    /** Character budget before truncating (default 160). */
    limit?: number;
    className?: string;
    buttonClassName?: string;
}) {
    const [expanded, setExpanded] = useState(false);
    const isLong = text.length > limit;

    let shown = text;
    if (isLong && !expanded) {
        const cut = text.slice(0, limit);
        const lastSpace = cut.lastIndexOf(' ');
        shown = `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
    }

    return (
        <p
            className={
                className ??
                'm-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'
            }>
            {shown}
            {isLong && (
                <>
                    {' '}
                    <motion.button
                        type='button'
                        onClick={() => setExpanded(v => !v)}
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className={
                            buttonClassName ??
                            'cursor-pointer border-none bg-transparent p-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] whitespace-nowrap text-it-primary'
                        }>
                        {expanded ? lessLabel : moreLabel}
                    </motion.button>
                </>
            )}
        </p>
    );
}
