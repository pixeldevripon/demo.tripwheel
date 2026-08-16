'use client';

import { cn } from '@/lib/utils';

type DiffOp = { type: 'same' | 'del' | 'add'; text: string };

/** Above this many tokens per side the O(n*m) LCS table stops being free -
 *  callers fall back to a stacked Current/Proposed view. */
export const INLINE_DIFF_TOKEN_CAP = 400;

/**
 * Word-level LCS diff. Fields are prose, so tokens are whitespace-separated
 * words; consecutive ops of one type merge back into phrases so the render
 * is a handful of spans, not one per word.
 */
export function diffWords(current: string, proposed: string): DiffOp[] {
    const a = current.split(/\s+/).filter(Boolean);
    const b = proposed.split(/\s+/).filter(Boolean);
    // LCS table (a.length+1 x b.length+1), then walk back.
    const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
        new Array<number>(b.length + 1).fill(0)
    );
    for (let i = a.length - 1; i >= 0; i--) {
        for (let j = b.length - 1; j >= 0; j--) {
            dp[i][j] =
                a[i] === b[j]
                    ? dp[i + 1][j + 1] + 1
                    : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const ops: DiffOp[] = [];
    const push = (type: DiffOp['type'], word: string) => {
        const last = ops[ops.length - 1];
        if (last && last.type === type) last.text += ` ${word}`;
        else ops.push({ type, text: word });
    };
    let i = 0;
    let j = 0;
    while (i < a.length && j < b.length) {
        if (a[i] === b[j]) {
            push('same', a[i]);
            i++;
            j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
            push('del', a[i]);
            i++;
        } else {
            push('add', b[j]);
            j++;
        }
    }
    while (i < a.length) push('del', a[i++]);
    while (j < b.length) push('add', b[j++]);
    return ops;
}

/**
 * One block that IS the edit: unchanged words plain, removed words struck in
 * red, added words highlighted green - the reviewer reads the change, not
 * two near-identical paragraphs (UX round 3).
 */
export function InlineDiff({
    current,
    proposed,
}: {
    current: string;
    proposed: string;
}) {
    const ops = diffWords(current, proposed);
    return (
        <p className='min-w-0 text-sm leading-relaxed text-content'>
            {ops.map((op, idx) => (
                <span
                    key={idx}
                    className={cn(
                        op.type === 'del' &&
                            'rounded-sm bg-danger-subtle px-0.5 text-danger-fg line-through decoration-danger-fg/60',
                        op.type === 'add' &&
                            'rounded-sm bg-success-subtle px-0.5 font-medium text-success-fg'
                    )}>
                    {op.text}
                    {idx < ops.length - 1 ? ' ' : ''}
                </span>
            ))}
        </p>
    );
}

/** Item-level variant for bullet-list fields (what to bring, know before
 *  you go, ...): kept items plain, removed struck, added highlighted.
 *  `variant='bullets'` renders the same ops as a real list - fields whose
 *  items ARE structured bullets (the conditions confirm-list) review as the
 *  traveller sees them, not as a dot-joined line. */
export function InlineListDiff({
    current,
    proposed,
    variant,
}: {
    current: string[];
    proposed: string[];
    variant?: 'bullets';
}) {
    const removed = current.filter(item => !proposed.includes(item));
    const items: Array<{ type: 'same' | 'del' | 'add'; text: string }> = [
        ...proposed.map(item => ({
            type: current.includes(item) ? ('same' as const) : ('add' as const),
            text: item,
        })),
        ...removed.map(item => ({ type: 'del' as const, text: item })),
    ];
    if (variant === 'bullets') {
        return (
            <ul className='min-w-0 list-disc space-y-0.5 pl-4 text-sm leading-relaxed text-content'>
                {items.map((item, idx) => (
                    <li
                        key={idx}
                        className={cn(
                            item.type === 'del' &&
                                'text-danger-fg line-through decoration-danger-fg/60',
                            item.type === 'add' &&
                                'font-medium text-success-fg'
                        )}>
                        {item.text}
                    </li>
                ))}
            </ul>
        );
    }
    return (
        <p className='min-w-0 text-sm leading-relaxed text-content'>
            {items.map((item, idx) => (
                <span key={idx}>
                    <span
                        className={cn(
                            item.type === 'del' &&
                                'rounded-sm bg-danger-subtle px-0.5 text-danger-fg line-through decoration-danger-fg/60',
                            item.type === 'add' &&
                                'rounded-sm bg-success-subtle px-0.5 font-medium text-success-fg'
                        )}>
                        {item.text}
                    </span>
                    {idx < items.length - 1 && (
                        <span className='text-content-subtle'> · </span>
                    )}
                </span>
            ))}
        </p>
    );
}
