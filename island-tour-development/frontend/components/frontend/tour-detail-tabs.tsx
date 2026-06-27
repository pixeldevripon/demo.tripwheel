'use client';

import { useEffect, useRef, useState } from 'react';

export type TourTab = {
    /** DOM id of the section this tab scrolls to. */
    id: string;
    label: string;
};

/**
 * Sticky in-page tab nav for the tour detail sections (Figma node 47936:3592).
 *
 * Reuses the Activity Hub tab design (`HubTripsTabs`): a horizontal-scroll row
 * with a full-width baseline hairline; the active tab carries the orange
 * underline + dark medium label, inactive tabs are muted with no underline.
 * 16px mobile / 20px desktop. Sticks below the fixed navbar. Clicking a tab
 * smooth-scrolls to its `#id` section; scrolling activates the tab of the section
 * currently under the bar (scrollspy). Targets that don't exist yet are inert, so
 * the nav works incrementally as detail sections are added.
 */
export function TourDetailTabs({ tabs }: { tabs: TourTab[] }) {
    const barRef = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(tabs[0]?.id ?? '');

    // Scrollspy: the active tab is the last section whose top has passed the bar.
    useEffect(() => {
        const onScroll = () => {
            const line = (barRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
            let current = '';
            for (const t of tabs) {
                const el = document.getElementById(t.id);
                if (el && el.getBoundingClientRect().top <= line) current = t.id;
            }
            if (current) setActive(current);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, [tabs]);

    const goTo = (id: string) => {
        setActive(id);
        const el = document.getElementById(id);
        if (!el) return;
        const offset = (barRef.current?.offsetHeight ?? 0) + 96;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    };

    return (
        <div
            ref={barRef}
            className='sticky top-18 z-30 bg-it-white md:top-20'>
            <div className='flex overflow-x-auto border-b border-it-heading/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
                {tabs.map(t => {
                    const isActive = active === t.id;
                    return (
                        <button
                            key={t.id}
                            type='button'
                            onClick={() => goTo(t.id)}
                            aria-current={isActive ? 'true' : undefined}
                            className={`-mb-px shrink-0 cursor-pointer whitespace-nowrap border-b-2 bg-transparent px-5 py-4 text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors md:px-7.5 md:py-5 md:text-[20px] ${
                                isActive
                                    ? 'border-it-primary font-medium text-it-heading'
                                    : 'border-transparent font-normal text-it-text-muted hover:text-it-heading'
                            }`}>
                            {t.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
