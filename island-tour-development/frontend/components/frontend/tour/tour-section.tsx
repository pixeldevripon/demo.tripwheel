'use client';

import Image from 'next/image';
import { useId, useState, type ReactNode } from 'react';

/**
 * One stacked tour-detail content section (Figma 47936:3606 and siblings):
 * a 24px heading with a collapse chevron on the right, over the section body.
 *
 * `scroll-mt` keeps anchors clear of the sticky navbar + TOC when a tab scrolls
 * here.
 *
 * Below md each section adds 8px on top of the stack's own 34px gap, so a seam
 * reads as a break rather than as continuous text on a phone (Pastel #34). The
 * offset lives here, on the sections themselves, so every seam gets it and no
 * single block ends up with an odd gap - and `not-first` keeps it off the top
 * of the stack, where it would just push the whole column down.
 *
 * ── The chevron ─────────────────────────────────────────────────────────────
 * Design v2 had removed the collapse affordance entirely ("plain and always
 * open"). Figma draws it again on every section head, pointing UP - the state
 * that means "open, press to close" - so it is a real control here, not a
 * decoration. A chevron that does nothing is worse than no chevron.
 *
 * Sections start OPEN and the body stays MOUNTED when closed - collapsed to
 * zero height through a `grid-rows` transition rather than unmounted. Two
 * reasons: the tab nav can scroll to a section the reader has collapsed, and
 * the page's content has to stay in the DOM for search engines and for in-page
 * find. Nothing is persisted; a reload reopens everything.
 */
export function TourSection({
    id,
    title,
    children,
}: {
    id: string;
    title: string;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(true);
    const bodyId = useId();

    return (
        <section
            id={id}
            className='flex scroll-mt-32 flex-col gap-4 max-md:not-first:mt-2'>
            <button
                type='button'
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
                aria-controls={bodyId}
                className='flex w-full cursor-pointer items-center justify-between gap-4 border-none bg-transparent p-0 text-left'>
                <h2 className='m-0 it-h2 leading-[1.2] text-it-heading font-medium '>
                    {title}
                </h2>
                {/* Figma rotates the shared arrow -90deg for the open state.
                    `rotate-*` is a standalone property in Tailwind v4, so the
                    transition names `rotate` - naming `transform` would match
                    nothing and the chevron would jump. */}
                <Image
                    src='/icons/tour/section-arrow.svg'
                    alt=''
                    width={24}
                    height={24}
                    className={`size-4 shrink-0 transition-[rotate] duration-(--it-duration-md) ease-(--it-ease) lg:size-5 ${
                        open ? '-rotate-90' : 'rotate-90'
                    }`}
                />
            </button>
            <div
                id={bodyId}
                className={`grid transition-[grid-template-rows] duration-(--it-duration-md) ease-(--it-ease) ${
                    open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}>
                <div className='overflow-hidden'>
                    <div className='flex flex-col gap-4'>{children}</div>
                </div>
            </div>
        </section>
    );
}
