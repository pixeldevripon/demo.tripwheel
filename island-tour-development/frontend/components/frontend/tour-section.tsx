'use client';

import Image from 'next/image';
import { useState, type ReactNode } from 'react';

/**
 * Collapsible tour detail section (Figma node 47936:3606 et al.). A heading row
 * (title + a chevron that rotates when open) toggles the body. Default open.
 *
 * Each section carries the `#id` the sticky tab nav scrolls to; `scroll-mt`
 * keeps the heading clear of the navbar + sticky tab bar on anchor jumps. The
 * separators and 40px rhythm between sections are owned by the parent.
 */
export function TourSection({
    id,
    title,
    defaultOpen = true,
    children,
}: {
    id: string;
    title: string;
    defaultOpen?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <section id={id} className='flex scroll-mt-36 flex-col gap-4'>
            <button
                type='button'
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className='flex w-full cursor-pointer items-center justify-between gap-4 border-none bg-transparent p-0 text-left'>
                <h2 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                    {title}
                </h2>
                <Image
                    src='/icons/section-collapse.svg'
                    alt=''
                    width={24}
                    height={24}
                    className={`size-6 shrink-0 self-center transition-transform duration-200 ${
                        open ? '' : 'rotate-180'
                    }`}
                />
            </button>
            {open && <div className='flex flex-col gap-8'>{children}</div>}
        </section>
    );
}
