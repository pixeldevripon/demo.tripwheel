'use client';

import { useState } from 'react';

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
                    <button
                        type='button'
                        onClick={() => setExpanded(v => !v)}
                        className={
                            buttonClassName ??
                            'cursor-pointer border-none bg-transparent p-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] whitespace-nowrap text-it-primary'
                        }>
                        {expanded ? lessLabel : moreLabel}
                    </button>
                </>
            )}
        </p>
    );
}
