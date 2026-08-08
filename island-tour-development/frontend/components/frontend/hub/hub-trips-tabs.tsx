'use client';

import { useDragScroll } from '@/hooks/use-drag-scroll';
import { useScrollOverflow } from '@/hooks/use-scroll-overflow';
import { useTabAutoScroll } from '@/hooks/use-tab-autoscroll';
import { edgeFadeMask } from '@/lib/edge-fade';
import { springPop } from '@/lib/motion';
import { motion, useReducedMotion } from 'framer-motion';
import { Reveal } from '../reveal';

export type HubTripsTab = { key: string; label: string };

/**
 * Hub trips tab bar (Figma node 48024:11222 desktop / 48539:15632 mobile).
 * Horizontal-scroll on mobile with a full-width baseline hairline; the active
 * tab carries the orange underline (a shared-layoutId span that slides between
 * tabs) + dark medium text. 16px mobile / 20px desktop. Controlled by the
 * parent (`active` index + `onChange`).
 *
 * Carries the same follow-the-active-tab scrolling and right-edge fade as the
 * tour page's section tabs (Pastel #56 asks for the two to stay consistent).
 * Here the active tab changes by TAP rather than by page scroll, so the row
 * rarely has to move itself - but a hub with more tabs than fit behaves the
 * same way when it does, and the fade tells you they are there either way.
 */
export function HubTripsTabs({
    tabs,
    active,
    onChange,
}: {
    tabs: HubTripsTab[];
    active: number;
    onChange: (index: number) => void;
}) {
    const scrollRef = useDragScroll<HTMLDivElement>();
    const { left, right } = useScrollOverflow(scrollRef);
    const reduce = useReducedMotion();
    useTabAutoScroll(scrollRef, tabs[active]?.key ?? '', !!reduce);

    return (
        <Reveal>
            {/* The hairline belongs to the wrapper, not the scroller: the mask
                would otherwise fade the rule away along with the tabs. */}
            <div className='border-b border-it-divider'>
            <div
                ref={scrollRef}
                className={`flex gap-[26px] overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${edgeFadeMask(left, right)}`}>
                {tabs.map((tab, i) => {
                    const isActive = i === active;
                    return (
                        <motion.button
                            key={tab.key}
                            type='button'
                            onClick={() => onChange(i)}
                            data-tab-key={tab.key}
                            aria-current={isActive ? 'true' : undefined}
                            whileTap={{ scale: 0.98 }}
                            transition={springPop}
                            className={`relative -mb-px shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent px-0.5 py-3.5 text-[14px] font-bold leading-[1.6] transition-colors duration-(--it-duration-xs) ${
                                isActive
                                    ? 'text-it-ink'
                                    : 'text-it-text-muted hover:text-it-ink'
                            }`}>
                            {tab.label}
                            {/* Underline slides between tabs (shared layoutId). */}
                            {isActive && (
                                <motion.span
                                    layoutId='hub-trips-tab-underline'
                                    transition={springPop}
                                    className='absolute inset-x-0 bottom-0 h-[2.5px] bg-it-primary'
                                />
                            )}
                        </motion.button>
                    );
                })}
            </div>
            </div>
        </Reveal>
    );
}

