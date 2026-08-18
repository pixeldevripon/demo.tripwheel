'use client';

import {
    useEffect,
    useRef,
    useState,
    type ReactElement,
    type ReactNode,
} from 'react';
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
 * The bar stays stuck all the way to the footer: the trailing page sections
 * (First timers / FAQ / Also worth) render as `children` inside the sticky
 * scope, so a reader deep in the page always has a way back to Trips. Those
 * sections are not tabs - past the end of the last panel (Discover) no tab
 * is highlighted.
 */
export function HubTripsSection({
    dict,
    children,
}: {
    dict: HubTripsDict;
    /** Page sections below the panels that the bar should keep sticking over. */
    children?: ReactNode;
}) {
    const [active, setActive] = useState<number | null>(0);
    const tabBarRef = useRef<HTMLDivElement>(null);
    const sectionRefs = useRef<(HTMLElement | null)[]>([]);

    // Scrollspy - the active tab is the last section whose top has scrolled
    // above the bottom edge of the sticky bar. Once the bottom of the last
    // section (Discover) passes that line, no section is current, so nothing
    // is highlighted (the trailing children are not tabs).
    useEffect(() => {
        const onScroll = () => {
            const line = (tabBarRef.current?.getBoundingClientRect().bottom ?? 0) + 8;
            let current: number | null = 0;
            let lastEl: HTMLElement | null = null;
            for (let i = 0; i < dict.panels.length; i++) {
                const el = sectionRefs.current[i];
                if (!dict.panels[i] || !el) continue;
                if (el.getBoundingClientRect().top <= line) current = i;
                lastEl = el;
            }
            if (lastEl && lastEl.getBoundingClientRect().bottom < line) {
                current = null;
            }
            setActive(current);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
        return () => window.removeEventListener('scroll', onScroll);
    }, [dict.panels]);

    const sectionId = (i: number) => `hub-section-${dict.tabs[i]?.key ?? i}`;

    const goTo = (i: number) => {
        // Resolve by id (DOM lookup) rather than the ref array, so navigation
        // is immune to ref-attachment timing.
        const el =
            document.getElementById(sectionId(i)) ?? sectionRefs.current[i];
        if (!el) return;
        // Manual offset scroll (not scrollIntoView): lands the section just below
        // the fixed navbar + sticky bar, and is reliable during the scrollspy
        // re-renders that fire mid-animation. Matches the sections' scroll-mt
        // (130 / 152px).
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
        // Sticky scope: the bar's containing block spans the panels AND the
        // trailing page sections (children), so the bar only releases at the
        // very bottom of the page content, right before the footer.
        <div>
            {/* The trips section's old pt-7, kept outside the sticky strip so
                the bar's natural resting position is unchanged. */}
            <div className='h-7 bg-it-white' />

            {/* Sticky scroll-nav - a full-bleed frosted strip below the fixed
                navbar (it also rides over the surface-tinted trailing sections,
                so it bleeds edge to edge like the navbar). The baseline hairline
                lives on the strip so it spans the full band, not just the
                container. (No position:fixed children may live in here -
                backdrop-filter creates a containing block.) */}
            <div
                ref={tabBarRef}
                className='sticky top-15 md:top-[72px] z-40 border-b border-it-divider bg-(--it-frow-bg) backdrop-blur-[8px]'>
                <div className='it-container'>
                    <HubTripsTabs
                        tabs={dict.tabs}
                        active={active}
                        onChange={goTo}
                    />
                </div>
            </div>

            <section className='bg-it-white pb-16'>
                <div className='it-container'>
                    {/* Stacked sections - each is a scroll target. The gap also
                        covers the old trailing block's leading padding. */}
                    <div className='flex flex-col gap-12 pt-6 md:gap-[72px] md:pt-9'>
                        {dict.panels.map((panel, i) => renderPanel(panel, i))}
                    </div>
                </div>
            </section>

            {/* Trailing page sections (First timers / FAQ / Also worth) - inside
                the sticky scope so the bar keeps showing over them. */}
            {children}
        </div>
    );
}
