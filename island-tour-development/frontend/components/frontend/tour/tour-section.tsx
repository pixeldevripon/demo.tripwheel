import type { ReactNode } from 'react';

/**
 * One stacked tour-detail content section (design v2 section.cs, LD17):
 * a display h2 over the section body. Plain and always open - the v2 page
 * has no collapse affordance. `scroll-mt` keeps anchors clear of the sticky
 * navbar + TOC when a tab scrolls here.
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
    return (
        <section id={id} className='flex scroll-mt-32 flex-col gap-3.5'>
            <h2 className='m-0 font-it-display text-[21px] font-bold leading-[1.2] tracking-[-0.012em] text-it-ink'>
                {title}
            </h2>
            <div className='flex flex-col gap-4'>{children}</div>
        </section>
    );
}
