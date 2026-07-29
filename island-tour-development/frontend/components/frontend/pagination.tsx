'use client';

import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import Image from 'next/image';

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
        children: React.ReactNode,
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
                    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
                        return;
                    }
                    e.preventDefault();
                    onClick?.(
                        e as unknown as React.MouseEvent<HTMLButtonElement>,
                    );
                }}
                {...(rest as React.ComponentProps<typeof motion.a>)}>
                {children}
            </motion.a>
        );
    };

    return (
        <nav
            aria-label={ariaLabel}
            className='flex items-center justify-center gap-5'>
            <motion.button
                type='button'
                aria-label='Previous page'
                disabled={page === 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                whileTap={page > 1 ? { scale: 0.9 } : undefined}
                transition={springPop}
                className='inline-flex cursor-pointer items-center border-none bg-transparent p-0 transition-opacity disabled:cursor-not-allowed disabled:opacity-30'>
                <Image
                    src='/icons/filters/pagination-arrow.svg'
                    alt=''
                    width={20}
                    height={20}
                    className='size-5 rotate-180'
                />
            </motion.button>

            {pages.map(n => (
                <span key={n}>
                    {control(
                        n,
                        {
                            'aria-current': n === page ? 'page' : undefined,
                            onClick: () => onPageChange(n),
                            whileTap: { scale: 0.9 },
                            transition: springPop,
                            className: `cursor-pointer border-none bg-transparent p-0 text-[16px] leading-[1.6] tracking-[-0.012em] no-underline transition-colors duration-300 ${
                                n === page
                                    ? 'text-it-heading'
                                    : 'text-it-heading/30 hover:text-it-heading'
                            }`,
                        },
                        n,
                    )}
                </span>
            ))}

            <motion.button
                type='button'
                aria-label='Next page'
                disabled={page === pageCount}
                onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                whileTap={page < pageCount ? { scale: 0.9 } : undefined}
                transition={springPop}
                className='inline-flex cursor-pointer items-center border-none bg-transparent p-0 transition-opacity disabled:cursor-not-allowed disabled:opacity-30'>
                <Image
                    src='/icons/filters/pagination-arrow.svg'
                    alt=''
                    width={20}
                    height={20}
                    className='size-5'
                />
            </motion.button>
        </nav>
    );
}

