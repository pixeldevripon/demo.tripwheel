'use client';

import { useEffect, useRef, useState, type ReactElement } from 'react';
import type { HubTourCardDict } from './hub-tour-card';
import {
    HubTripsPanel,
    type HubTripsFilterDict,
    type HubTripsPanelData,
} from './hub-trips-panel';
import { HubTripsTabs, type HubTripsTab } from './hub-trips-tabs';

type HubTripsDict = {
    tabs: HubTripsTab[];
    /**
     * Panel per tab, index-aligned to `tabs`; `null` = not designed yet. A plain
     * `HubTripsPanelData` renders the standard trips/charters panel; a pre-built
     * element (e.g. <HubCompareSection>, <HubDiscoverSection>) renders as-is, so
     * any section can bind to the sticky scroll-nav like Trips / Private charters.
     */
    panels: (HubTripsPanelData | ReactElement | null)[];
    selectDate: string;
    /** Copy for the date-availability filter on each trips/charters panel. */
    filter: HubTripsFilterDict;
    card: HubTourCardDict;
};

export type { HubTripsPanelData, HubCardGroup } from './hub-trips-panel';

/**
 * Hub trips/charters listing (Figma nodes 48024:11222 + 48024:11455). The panels
 * render stacked, one section after another; the tab bar is a sticky scroll-nav:
 * clicking a tab smooth-scrolls to its section, and scrolling activates the tab
 * of the section currently under the bar (scrollspy). Tabs without a designed
 * panel are inert. The bar sticks below the fixed navbar (h-18/20).
 *
 * The sticky tab bar is scoped to every section up to (but not including) the
 * "discover" tab: its containing block ends where Discover begins, so the bar
 * releases and scrolls away once the reader reaches Discover. Clicking the
 * Discover tab still scrolls there (it targets the section ref directly).
 */
export function HubTripsSection({ dict }: { dict: HubTripsDict }) {
    const [active, setActive] = useState(0);
    const tabBarRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<(HTMLElement | null)[]>([]);

    // Index where the sticky scope ends - the "discover" tab and everything
    // after it render outside the sticky containing block. Falls back to the
    // full list when there is no Discover tab (bar sticks through every section).
    const discoverIndex = dict.tabs.findIndex((t) => t.key === 'discover');
    const stickyEnd = discoverIndex === -1 ? dict.panels.length : discoverIndex;

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

    const sectionId = (i: number) => `hub-section-${dict.tabs[i]?.key ?? i}`;

    const goTo = (i: number) => {
        // Resolve by id (DOM lookup) rather than the ref array, so navigation
        // works regardless of which scope a section renders in (the sticky scope
        // or the trailing Discover block) and is immune to ref-attachment timing.
        const el =
            document.getElementById(sectionId(i)) ?? sectionRefs.current[i];
        if (!el) return;
        // Manual offset scroll (not scrollIntoView): lands the section just below
        // the fixed navbar + sticky bar, and is reliable when the bar releases at
        // the trailing (Discover) section and during the scrollspy re-renders that
        // fire mid-animation. Matches the sections' scroll-mt (130 / 152px).
        const offset = window.innerWidth >= 768 ? 152 : 130;
        const top = el.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
    };

    // One stacked, scroll-target section. Plain panel data (has `groups`) renders
    // via HubTripsPanel; anything else is a pre-built element (e.g. Compare /
    // Discover) rendered as-is. Shape check, not isValidElement - server-component
    // elements lose element-ness crossing the RSC boundary into this client component.
    const renderPanel = (panel: HubTripsDict['panels'][number], i: number) => {
        if (!panel) return null;
        const isPanelData = typeof panel === 'object' && 'groups' in panel;
        return (
            <section
                key={dict.tabs[i]?.key ?? i}
                id={sectionId(i)}
                ref={(el) => {
                    sectionRefs.current[i] = el;
                }}
                className='scroll-mt-32.5 md:scroll-mt-38'>
                {isPanelData ? (
                    <HubTripsPanel
                        panel={panel}
                        selectDate={dict.selectDate}
                        filter={dict.filter}
                        card={dict.card}
                    />
                ) : (
                    panel
                )}
            </section>
        );
    };

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                {/* Sticky scope: the bar's containing block ends here, so it
                    releases when the trailing (Discover) sections begin. */}
                <div>
                    {/* Sticky scroll-nav - sits below the fixed navbar. */}
                    <div
                        ref={tabBarRef}
                        className='sticky top-18 z-40 bg-it-white md:top-20'>
                        <HubTripsTabs
                            tabs={dict.tabs}
                            active={active}
                            onChange={goTo}
                        />
                    </div>

                    {/* Sticky-scoped sections - each is a scroll target. */}
                    <div className='flex flex-col gap-16 pt-6 md:gap-25 md:pt-10'>
                        {dict.panels
                            .slice(0, stickyEnd)
                            .map((panel, i) => renderPanel(panel, i))}
                    </div>
                </div>

                {/* Trailing sections (Discover) - outside the sticky scope, so the
                    tab bar is no longer sticky here. The leading spacing matches
                    the inter-section gap above. */}
                {stickyEnd < dict.panels.length && (
                    <div className='flex flex-col gap-16 pt-16 md:gap-25 md:pt-25'>
                        {dict.panels
                            .slice(stickyEnd)
                            .map((panel, offset) =>
                                renderPanel(panel, stickyEnd + offset),
                            )}
                    </div>
                )}
            </div>
        </section>
    );
}
