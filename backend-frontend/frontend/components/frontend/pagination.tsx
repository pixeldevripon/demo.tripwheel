'use client';

import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';

/**
 * Reusable numbered pagination (Figma node 47167:4317): ‹ arrow · numbered pages
 * · arrow ›. Controlled — the parent owns the current page and reacts to
 * `onPageChange` (local state on the tours grid, URL navigation on search).
 */
export function Pagination({
    page,
    pageCount,
    onPageChange,
    hrefFor,
    ariaLabel = 'Pagination',
}: {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
    /**
     * Real URL for a page number. Supply it on any PUBLIC listing and the
     * controls render as anchors, with `onPageChange` still driving the
     * client-side transition on click.
     *
     * Without it these are bare `<button onClick>`s, which means a crawler sees
     * no path to page 2+ and no link equity flows there. Optional because the
     * private surfaces (the traveller account) and local-state grids have no
     * URL to point at - and for those, buttons are correct.
     */
    hrefFor?: (page: number) => string;
    ariaLabel?: string;
}) {
    if (pageCount <= 1) return null;
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

    /**
     * Anchor when we have a URL, button otherwise. The click handler still
     * calls `onPageChange` and prevents default, so the client-side transition
     * is unchanged - the href is there for crawlers, middle-click and
     * "open in new tab", which a button silently breaks.
     */
    const control = (
        n: number,
        props: React.ComponentProps<typeof motion.button>,
        children: React.ReactNode
    ) => {
        const href = hrefFor?.(n);
        if (!href || props.disabled) {
            return (
                <motion.button type='button' {...props}>
                    {children}
                </motion.button>
            );
        }
        const { onClick, disabled: _disabled, ...rest } = props;
        return (
            <motion.a
                href={href}
                onClick={e => {
                    // Let modified clicks (new tab/window) behave natively.
                    if (
                        e.metaKey ||
                        e.ctrlKey ||
                        e.shiftKey ||
                        e.button !== 0
                    ) {
                        return;
                    }
                    e.preventDefault();
                    onClick?.(
                        e as unknown as React.MouseEvent<HTMLButtonElement>
                    );
                }}
                {...(rest as React.ComponentProps<typeof motion.a>)}>
                {children}
            </motion.a>
        );
    };

    // Figma 47167:4031: bare numerals on a 20px rhythm - no cells, no borders,
    // no inverted square. The page you are on is full ink; the rest sit at 30%,
    // which is the whole of the active/idle distinction. Digits are tabular so
    // the row does not shift width as the numbers change.
    const cellBase =
        'inline-flex cursor-pointer items-center justify-center border-none bg-transparent p-0 it-text tabular-nums no-underline transition-colors duration-(--it-duration-md) ease-(--it-ease-out) ';

    return (
        <nav
            aria-label={ariaLabel}
            className='flex items-center py-14 justify-center gap-4 md:gap-5'>
            <motion.button
                type='button'
                aria-label='Previous page'
                disabled={page === 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                whileTap={page > 1 ? { scale: 0.95 } : undefined}
                transition={springPop}
                className={`${cellBase} text-it-heading hover:text-it-primary disabled:cursor-default disabled:text-it-heading/30 disabled:hover:text-it-heading/30`}>
                <span aria-hidden='true' className='text-[14.5px] leading-none md:text-[18px]'>
                    ←
                </span>
            </motion.button>

            {pages.map(n => (
                <span key={n}>
                    {control(
                        n,
                        {
                            'aria-current': n === page ? 'page' : undefined,
                            onClick: () => onPageChange(n),
                            whileTap: { scale: 0.95 },
                            transition: springPop,
                            className: `${cellBase} ${
                                n === page
                                    ? 'font-medium text-it-heading'
                                    : 'text-it-heading/30 hover:text-it-heading'
                            }`,
                        },
                        n
                    )}
                </span>
            ))}

            <motion.button
                type='button'
                aria-label='Next page'
                disabled={page === pageCount}
                onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                whileTap={page < pageCount ? { scale: 0.95 } : undefined}
                transition={springPop}
                className={`${cellBase} text-it-heading hover:text-it-primary disabled:cursor-default disabled:text-it-heading/30 disabled:hover:text-it-heading/30`}>
                <span aria-hidden='true' className='text-[14.5px] leading-none md:text-[18px]'>
                    →
                </span>
            </motion.button>
        </nav>
    );
}

