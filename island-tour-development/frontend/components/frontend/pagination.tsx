'use client';

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
    ariaLabel = 'Pagination',
}: {
    page: number;
    pageCount: number;
    onPageChange: (page: number) => void;
    ariaLabel?: string;
}) {
    if (pageCount <= 1) return null;
    const pages = Array.from({ length: pageCount }, (_, i) => i + 1);

    return (
        <nav aria-label={ariaLabel} className='flex items-center justify-center gap-5'>
            <button
                type='button'
                aria-label='Previous page'
                disabled={page === 1}
                onClick={() => onPageChange(Math.max(1, page - 1))}
                className='inline-flex cursor-pointer items-center border-none bg-transparent p-0 transition-opacity disabled:cursor-not-allowed disabled:opacity-30'>
                <Image
                    src='/icons/filters/pagination-arrow.svg'
                    alt=''
                    width={20}
                    height={20}
                    className='size-5 rotate-180'
                />
            </button>

            {pages.map((n) => (
                <button
                    key={n}
                    type='button'
                    aria-current={n === page ? 'page' : undefined}
                    onClick={() => onPageChange(n)}
                    className={`cursor-pointer border-none bg-transparent p-0 text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors ${
                        n === page
                            ? 'text-it-heading'
                            : 'text-it-heading/30 hover:text-it-heading'
                    }`}>
                    {n}
                </button>
            ))}

            <button
                type='button'
                aria-label='Next page'
                disabled={page === pageCount}
                onClick={() => onPageChange(Math.min(pageCount, page + 1))}
                className='inline-flex cursor-pointer items-center border-none bg-transparent p-0 transition-opacity disabled:cursor-not-allowed disabled:opacity-30'>
                <Image
                    src='/icons/filters/pagination-arrow.svg'
                    alt=''
                    width={20}
                    height={20}
                    className='size-5'
                />
            </button>
        </nav>
    );
}
