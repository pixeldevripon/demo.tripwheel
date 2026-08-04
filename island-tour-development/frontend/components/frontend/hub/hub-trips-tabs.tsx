'use client';

import { useDragScroll } from '@/hooks/use-drag-scroll';
import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import { Reveal } from '../reveal';

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
        <Reveal>
            <div
                ref={scrollRef}
                className='flex gap-[26px] overflow-x-auto border-b border-it-divider [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'>
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
                            className={`relative -mb-px shrink-0 cursor-pointer whitespace-nowrap border-none bg-transparent px-0.5 py-3.5 text-[14px] font-medium leading-[1.6] transition-colors duration-(--it-duration-xs) ${
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
        </Reveal>
    );
}

