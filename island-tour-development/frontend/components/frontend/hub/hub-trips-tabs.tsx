'use client';

import { motion } from 'framer-motion';
import { springPop } from '@/lib/motion';
import { useDragScroll } from '@/hooks/use-drag-scroll';

export type HubTripsTab = { key: string; label: string };

/**
 * Hub trips tab bar (Figma node 48024:11222 desktop / 48539:15632 mobile).
 * Horizontal-scroll on mobile with a full-width baseline hairline; the active
 * tab carries the orange underline (a shared-layoutId span that slides between
 * tabs) + dark medium text. 16px mobile / 20px desktop. Controlled by the
 * parent (`active` index + `onChange`).
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
    return (
        <div
            ref={scrollRef}
            className='flex overflow-x-auto border-b border-it-heading/10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
            {tabs.map((tab, i) => {
                const isActive = i === active;
                return (
                    <motion.button
                        key={tab.key}
                        type='button'
                        onClick={() => onChange(i)}
                        aria-current={isActive ? 'true' : undefined}
                        whileTap={{ scale: 0.98 }}
                        transition={springPop}
                        className={`relative -mb-px shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent px-5 py-4 text-[16px] leading-[1.6] tracking-[-0.012em] transition-colors duration-300 md:px-7.5 md:py-5 md:text-[20px] ${
                            isActive
                                ? 'font-medium text-it-heading'
                                : 'font-normal text-it-text-muted hover:text-it-heading'
                        }`}>
                        {tab.label}
                        {/* Underline slides between tabs (shared layoutId). */}
                        {isActive && (
                            <motion.span
                                layoutId='hub-trips-tab-underline'
                                transition={springPop}
                                className='absolute inset-x-0 bottom-0 h-0.5 bg-it-primary'
                            />
                        )}
                    </motion.button>
                );
            })}
        </div>
    );
}
