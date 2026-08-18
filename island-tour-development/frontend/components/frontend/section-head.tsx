import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * The site's section head: a small orange kicker over a display-font `h2`, with
 * an optional action pinned to the right edge (design v2 `.sechead`).
 *
 * ONE definition, because the exact same markup was written out three times -
 * "Explore by type", "Locals' favorites" and now the search recovery band - and
 * a fourth copy is how the kicker's tracking or the heading's clamp drifts on
 * one page only. The classes here are the ones those sections already shipped,
 * so this is a lift, not a restyle.
 *
 * `h2` is fixed rather than configurable: every call site is a section INSIDE a
 * page that already owns its `h1`, and letting the level be passed in is how a
 * heading outline quietly becomes wrong.
 */
export function SectionHead({
    kicker,
    title,
    action,
    className,
}: {
    /** Small uppercase line above the title. Omitted when there is nothing to say. */
    kicker?: string;
    title: string;
    /** Right-aligned link/button. `items-end` keeps it on the title's baseline. */
    action?: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn('flex items-end justify-between gap-6', className)}>
            <div>
                {kicker && (
                    <div className='mb-2 text-[11.5px] font-medium uppercase tracking-[0.13em] text-it-primary-hover'>
                        {kicker}
                    </div>
                )}
                <h2 className='m-0 text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                    {title}
                </h2>
            </div>
            {action}
        </div>
    );
}
