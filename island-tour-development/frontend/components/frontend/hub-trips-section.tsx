'use client';

import { useEffect, useRef, useState } from 'react';
import type { HubTourCardDict } from './hub-tour-card';
import { HubTripsPanel, type HubTripsPanelData } from './hub-trips-panel';
import { HubTripsTabs, type HubTripsTab } from './hub-trips-tabs';

type HubTripsDict = {
    tabs: HubTripsTab[];
    /** Panel per tab, index-aligned to `tabs`; `null` = not designed yet. */
    panels: (HubTripsPanelData | null)[];
    selectDate: string;
    card: HubTourCardDict;
};

export type { HubTripsPanelData, HubCardGroup } from './hub-trips-panel';

/**
 * Hub trips/charters listing (Figma nodes 48024:11222 + 48024:11455). The panels
 * render stacked, one section after another; the tab bar is a sticky scroll-nav:
 * clicking a tab smooth-scrolls to its section, and scrolling activates the tab
 * of the section currently under the bar (scrollspy). Tabs without a designed
 * panel are inert. The bar sticks below the fixed navbar (h-18/20).
 */
export function HubTripsSection({ dict }: { dict: HubTripsDict }) {
    const [active, setActive] = useState(0);
    const tabBarRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<(HTMLElement | null)[]>([]);

    // Scrollspy - the active tab is the last section whose top has scrolled
    // above the bottom edge of the sticky bar.
    useEffect(() => {
        const onScroll = () => {
            const line = (tabBarRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
            let current = 0;
            dict.panels.forEach((panel, i) => {
                const el = sectionRefs.current[i];
                if (panel && el && el.getBoundingClientRect().top <= line) current = i;
            });
            setActive(current);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, [dict.panels]);

    const goTo = (i: number) => {
        sectionRefs.current[i]?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                {/* Sticky scroll-nav - sits below the fixed navbar. */}
                <div
                    ref={tabBarRef}
                    className='sticky top-18 z-40 bg-it-white md:top-20'>
                    <HubTripsTabs tabs={dict.tabs} active={active} onChange={goTo} />
                </div>

                {/* Stacked sections - each is a scroll target. */}
                <div className='flex flex-col gap-16 pt-6 md:gap-25 md:pt-10'>
                    {dict.panels.map((panel, i) =>
                        panel ? (
                            <section
                                key={dict.tabs[i]?.key ?? i}
                                ref={(el) => {
                                    sectionRefs.current[i] = el;
                                }}
                                className='scroll-mt-32.5 md:scroll-mt-38'>
                                <HubTripsPanel
                                    panel={panel}
                                    selectDate={dict.selectDate}
                                    card={dict.card}
                                />
                            </section>
                        ) : null,
                    )}
                </div>
            </div>
        </section>
    );
}
