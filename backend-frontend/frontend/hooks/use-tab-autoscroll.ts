'use client';

import { useEffect, useRef, type RefObject } from 'react';

import { EDGE_FADE_PX } from '@/lib/edge-fade';

/** How long after the visitor stops touching the row before it may move itself. */
const GRACE_MS = 900;

/**
 * Keep the ACTIVE tab inside a horizontally scrolling tab row (Pastel #56).
 *
 * The tour page has seven sections and a 375px row. From "Meeting & pickup"
 * onward the active tab sat past the right edge, so on four of the seven
 * sections nothing on screen told you where you were - the underline was
 * tracking correctly, just off screen.
 *
 * THE ROW SCROLLS, NEVER THE PAGE. `scrollIntoView` walks up the ancestor chain
 * and will happily scroll the document too, which on a page whose scroll
 * position is what selected the tab in the first place is a feedback loop.
 * `row.scrollTo` touches one element and cannot.
 *
 * IT STANDS DOWN WHILE THE VISITOR IS SWIPING. Pulling the row back under a
 * finger is the specific thing the client ruled out, and it is what any naive
 * "scroll the active tab into view" does: the reader swipes to look ahead, the
 * page scrolls a pixel, the row yanks itself back. Any pointer or touch on the
 * row suspends it until a grace period after the last interaction.
 *
 * ALREADY-VISIBLE TABS ARE LEFT ALONE - including one merely near the edge,
 * which is why the visible band is inset by the fade width: a tab sitting under
 * the fade is not "visible", and nudging it clear is the difference between a
 * row that helps and a row that fidgets.
 */
export function useTabAutoScroll(
    rowRef: RefObject<HTMLElement | null>,
    /** DOM id or key of the active tab, matched against `data-tab-key`. */
    activeKey: string,
    /** Jump instead of sliding (from `useReducedMotion`). */
    reduce: boolean
): void {
    // Not state: this must not re-render anything, and the effect below reads
    // it at the moment it runs rather than closing over a stale copy.
    const heldBack = useRef(false);

    useEffect(() => {
        const row = rowRef.current;
        if (!row) return;

        let timer: ReturnType<typeof setTimeout> | undefined;
        const hold = () => {
            heldBack.current = true;
            clearTimeout(timer);
        };
        const release = () => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                heldBack.current = false;
            }, GRACE_MS);
        };

        row.addEventListener('pointerdown', hold);
        row.addEventListener('touchstart', hold, { passive: true });
        // `scroll` covers momentum: a flick keeps scrolling long after the
        // finger is gone, and the row must not fight the tail of it.
        row.addEventListener('scroll', release, { passive: true });
        row.addEventListener('pointerup', release);
        row.addEventListener('pointercancel', release);
        row.addEventListener('touchend', release, { passive: true });

        return () => {
            clearTimeout(timer);
            row.removeEventListener('pointerdown', hold);
            row.removeEventListener('touchstart', hold);
            row.removeEventListener('scroll', release);
            row.removeEventListener('pointerup', release);
            row.removeEventListener('pointercancel', release);
            row.removeEventListener('touchend', release);
        };
    }, [rowRef]);

    useEffect(() => {
        const row = rowRef.current;
        if (!row || heldBack.current) return;

        const tab = row.querySelector<HTMLElement>(
            `[data-tab-key="${CSS.escape(activeKey)}"]`
        );
        if (!tab) return;

        // The band the tab must sit fully inside: the row minus a fade at each
        // end, so it never lands half under one.
        const start = row.scrollLeft + EDGE_FADE_PX;
        const end = row.scrollLeft + row.clientWidth - EDGE_FADE_PX;
        if (tab.offsetLeft >= start && tab.offsetLeft + tab.offsetWidth <= end) {
            return;
        }

        // Centred, so the tabs on either side stay readable as context. Clamped
        // by the browser, so the first and last tab simply rest against their
        // end of the row.
        row.scrollTo({
            left: tab.offsetLeft - (row.clientWidth - tab.offsetWidth) / 2,
            behavior: reduce ? 'auto' : 'smooth',
        });
    }, [rowRef, activeKey, reduce]);
}
