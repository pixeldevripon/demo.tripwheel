'use client';

import { useEffect } from 'react';

/**
 * Keeps `--overlay-center-offset` on :root equal to HALF of the content
 * pane's left edge (the space the sidebar occupies). Centered overlays
 * (dialog / alert-dialog / command palette) add it to `left: 50%` on lg+
 * so they center over the CONTENT pane, not the viewport - a
 * viewport-centered modal reads as off-center next to the sidebar, and the
 * miss grows with screen width (144px on a 2560-wide screen).
 *
 * Measured from the real `SidebarInset` box instead of the sidebar state so
 * every case falls out for free: expanded (288px -> 144px offset),
 * icon-collapsed (~56px -> ~28px), mobile sheet (inset starts at 0 -> 0px),
 * and any future width change. ResizeObserver covers window resizes too:
 * the inset's own width changes with the viewport.
 */
export function OverlayCenterSync() {
    useEffect(() => {
        const inset = document.querySelector<HTMLElement>(
            'main[data-slot="sidebar-inset"]',
        );
        if (!inset) return;

        const root = document.documentElement;
        const sync = () =>
            root.style.setProperty(
                '--overlay-center-offset',
                `${Math.round(inset.getBoundingClientRect().left / 2)}px`,
            );

        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(inset);
        return () => {
            ro.disconnect();
            root.style.removeProperty('--overlay-center-offset');
        };
    }, []);

    return null;
}