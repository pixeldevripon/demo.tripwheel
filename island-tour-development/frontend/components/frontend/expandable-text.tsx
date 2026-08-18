'use client';

import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import { useState } from 'react';

/**
 * The first `count` sentences of `text`, or `null` when it has fewer than that
 * many sentence ends - which is the signal to fall back to a character budget.
 *
 * A sentence end is `.`, `!`, `?` or their full-width forms followed by
 * whitespace or the end of the string. Requiring the whitespace is what keeps
 * "$139." and "e.g." from ending a sentence.
 */
function firstSentences(text: string, count: number): string | null {
    const ends: number[] = [];
    const pattern = /[.!?\u3002\uff01\uff1f]+(?=\s|$)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
        ends.push(match.index + match[0].length);
        if (ends.length > count) break;
    }
    if (ends.length <= count) return null;
    return text.slice(0, ends[count - 1]);
}

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
    sentenceLimit,
    className,
    buttonClassName,
}: {
    text: string;
    moreLabel: string;
    lessLabel: string;
    /** Character budget before truncating (default 160). */
    limit?: number;
    /**
     * Cut after this many SENTENCES instead of by character count. A character
     * budget cuts mid-thought; where the excerpt is the whole point of the
     * layout - the review cards, whose heights the longest text used to
     * decide - a sentence boundary is the honest place to stop.
     *
     * Falls back to the character budget when the text has fewer sentence ends
     * than asked for (one long unpunctuated paragraph), so nothing can escape
     * truncation by simply not using full stops.
     */
    sentenceLimit?: number;
    className?: string;
    buttonClassName?: string;
}) {
    const [expanded, setExpanded] = useState(false);

    // Sentence mode first, character budget as the fallback for both an absent
    // `sentenceLimit` and a text with too few sentence ends to cut on.
    const excerpt = sentenceLimit
        ? firstSentences(text, sentenceLimit)
        : null;
    const isLong =
        excerpt != null ? excerpt.length < text.length : text.length > limit;

    let shown = text;
    if (isLong && !expanded) {
        if (excerpt != null) {
            shown = `${excerpt.trimEnd()}...`;
        } else {
            const cut = text.slice(0, limit);
            const lastSpace = cut.lastIndexOf(' ');
            shown = `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
        }
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

