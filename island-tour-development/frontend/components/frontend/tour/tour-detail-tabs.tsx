'use client';

import { useDragScroll } from '@/hooks/use-drag-scroll';
import { useScrollOverflow } from '@/hooks/use-scroll-overflow';
import { useTabAutoScroll } from '@/hooks/use-tab-autoscroll';
import { edgeFadeMask } from '@/lib/edge-fade';
import { smoothScrollToId } from '@/lib/motion/smooth-scroll';
import { motion, useReducedMotion } from 'framer-motion';
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
    const scrollRef = useDragScroll<HTMLDivElement>();
    const [active, setActive] = useState(tabs[0]?.id ?? '');
    const reduce = useReducedMotion();
    const { left, right } = useScrollOverflow(scrollRef);
    useTabAutoScroll(scrollRef, active, !!reduce);
    // True while a click-triggered scroll animates: the spy stays quiet so the
    // underline glides straight to the clicked tab instead of hopping through
    // every section the scroll passes.
    const spyLocked = useRef(false);

    // Scrollspy: the active tab is the last section whose top has passed the
    // bar. rAF-throttled (one measurement per frame) so fast scrolling stays
    // smooth, and suspended while a programmatic scroll is in flight.
    useEffect(() => {
        let frame = 0;
        const onScroll = () => {
            if (spyLocked.current || frame) return;
            frame = requestAnimationFrame(() => {
                frame = 0;
                const line =
                    (barRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
                let current = '';
                for (const t of tabs) {
                    const el = document.getElementById(t.id);
                    if (el && el.getBoundingClientRect().top <= line)
                        current = t.id;
                }
                if (current) setActive(current);
            });
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => {
            window.removeEventListener('scroll', onScroll);
            if (frame) cancelAnimationFrame(frame);
        };
    }, [tabs]);

    const goTo = async (id: string) => {
        // The clicked tab activates immediately (one clean underline glide via
        // the shared layoutId); the spy unlocks once the scroll settles.
        setActive(id);
        spyLocked.current = true;
        const offset = (barRef.current?.offsetHeight ?? 0) + 96;
        await smoothScrollToId(id, offset, !!reduce);
        spyLocked.current = false;
    };

    return (
        // Design v2 .toc: sticky under the navbar on the blurred white band
        // with the divider hairline. (No position:fixed children may live in
        // here - backdrop-filter creates a containing block.)
        <div
            ref={barRef}
            className='sticky top-16 z-30 bg-(--it-frow-bg) backdrop-blur-[8px]'>
            {/* The fade goes on the SCROLLER itself, so it tracks the row's own
                position rather than the bar's. The baseline hairline is the
                bar's, not the row's, or the mask would fade the rule away with
                the tabs. */}
            <div className='border-b border-it-divider'>
            <div
                ref={scrollRef}
                className={`flex gap-0.5 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${edgeFadeMask(left, right)}`}>
                {tabs.map(t => {
                    const isActive = active === t.id;
                    return (
                        <motion.button
                            key={t.id}
                            type='button'
                            onClick={() => goTo(t.id)}
                            data-tab-key={t.id}
                            aria-current={isActive ? 'true' : undefined}
                            className={`relative -mb-px shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent px-[13px] py-3 text-[13px] leading-[1.6] transition-colors duration-(--it-duration-xs) ease-(--it-ease) ${
                                isActive
                                    ? 'font-medium text-it-primary-hover'
                                    : 'font-medium text-it-text-muted hover:text-it-heading'
                            }`}>
                            {/* One-cell grid: the invisible bold twin reserves
                                the ACTIVE width, so the bold/semibold toggle
                                never resizes a tab (no row layout shift). */}
                            <span className='inline-grid justify-items-center'>
                                <span className='col-start-1 row-start-1'>
                                    {t.label}
                                </span>
                                <span
                                    aria-hidden
                                    className='invisible col-start-1 row-start-1 font-medium'>
                                    {t.label}
                                </span>
                            </span>
                            {/* Underline slides between tabs (shared layoutId). */}
                            {isActive && (
                                <motion.span
                                    layoutId='tour-tab-underline'
                                    className='absolute inset-x-0 bottom-0 h-0.5 bg-it-primary'
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>
            </div>
        </div>
    );
}

