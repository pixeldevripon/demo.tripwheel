'use client';

import { usePathname } from 'next/navigation';
import * as React from 'react';

/**
 * One-shot "this moves sideways" hint - the platform-standard way a horizontal
 * scroller announces itself (mck-16 §4.8). The first time the scroller is
 * properly on screen its content nudges a short distance left and settles
 * back, so the movement is SEEN once instead of guessed from a scrollbar that
 * only appears after scrolling has already started.
 *
 * Hard limits, all from the spec:
 * - Once per scroller per visit. Per element by default; pass `groupId` to
 *   share the once-flag across sibling rows (a page of repeated photo rails
 *   announces the pattern once, not once per row). Group flags are scoped to
 *   the pathname, so the same rail on another page still gets its hint.
 * - Never while a finger is on the scroller: a pointer down before the hint
 *   defers it to release; a pointer down during it stops it dead and leaves
 *   the user in control.
 * - Never coupled to page scroll depth: entering the viewport arms a short
 *   settle timer and the movement itself is a fixed time-based animation,
 *   never scroll-linked.
 * - Skipped entirely under `prefers-reduced-motion`.
 * - Skipped when there is nothing to reveal (no overflow) and consumed when
 *   the user has already scrolled the row themselves.
 *
 * Attach to the element that actually overflows - the same ref the other
 * scroll hooks take, so it composes with `useDragScroll`/`useScrollOverflow`:
 *
 * @example
 *   const rowRef = useDragScroll<HTMLDivElement>()
 *   useScrollHintNudge(rowRef, { groupId: 'review-photos' })
 *
 * Server components can't hold a ref - wrap their scroller in
 * `<ScrollHintRow>` (components/frontend/scroll-hint.tsx) instead.
 */

/** Scrollers that already spent their hint this pageview. */
const playedElements = new WeakSet<Element>();
/** Group keys (`pathname::groupId`) that already spent their hint. */
const playedGroups = new Set<string>();
/** Hint animations currently running, keyed by their scroller. */
const activeHints = new WeakMap<Element, () => void>();

/**
 * Cut a running hint short (no-op otherwise) - for navigation controls that
 * scroll the same element (e.g. ScrollHintRow's dots): real navigation must
 * never fight the announcement animation for `scrollLeft`.
 */
export function cancelScrollHint(el: Element | null) {
    if (el) activeHints.get(el)?.();
}

export interface ScrollHintNudgeOptions {
    /** Fraction of the scroller that must be visible to arm the hint (0-1). */
    amount?: number;
    /** Peak sideways travel in px - clamped to the real overflow. */
    distance?: number;
    /** Pause between entering view and moving (ms), so entrances settle. */
    settleMs?: number;
    /** Share one hint across sibling scrollers rendered on the same page. */
    groupId?: string;
}

/** Total out-and-back duration (ms). */
const DURATION = 800;
/** Below this much horizontal overflow there is nothing worth announcing. */
const MIN_OVERFLOW = 24;

export function useScrollHintNudge<T extends HTMLElement>(
    ref: React.RefObject<T | null>,
    { amount = 0.35, distance = 52, settleMs = 450, groupId }: ScrollHintNudgeOptions = {}
) {
    const pathname = usePathname();
    const groupKey = groupId ? `${pathname}::${groupId}` : null;

    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;

        let timer = 0;
        let raf = 0;
        let animating = false;
        let pointerDown = false;
        let intersecting = false;

        const played = () =>
            playedElements.has(el) || (groupKey !== null && playedGroups.has(groupKey));
        const markPlayed = () => {
            playedElements.add(el);
            if (groupKey !== null) playedGroups.add(groupKey);
        };
        const maxScroll = () => el.scrollWidth - el.clientWidth;

        const observer = new IntersectionObserver(
            ([entry]) => {
                intersecting = entry.isIntersecting;
                if (intersecting) schedule();
                else window.clearTimeout(timer);
            },
            { threshold: amount }
        );

        const teardown = () => {
            window.clearTimeout(timer);
            cancelAnimationFrame(raf);
            observer.disconnect();
            el.removeEventListener('scroll', onScroll);
            el.removeEventListener('pointerdown', onPointerDown);
            el.removeEventListener('pointerup', onPointerUp);
            el.removeEventListener('pointercancel', onPointerUp);
        };

        const schedule = () => {
            window.clearTimeout(timer);
            if (played() || pointerDown) return;
            timer = window.setTimeout(fire, settleMs);
        };

        const fire = () => {
            if (played()) return teardown();
            // Left the viewport (or a finger landed) during the settle pause -
            // the hint is not spent; it re-arms on the next entry/release.
            if (!intersecting || pointerDown) return;
            // Nothing hidden, or the user already scrolled: nothing to announce.
            if (el.scrollLeft > 1 || maxScroll() < MIN_OVERFLOW) {
                markPlayed();
                return teardown();
            }
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                markPlayed();
                return teardown();
            }
            markPlayed();
            animate();
        };

        const animate = () => {
            const travel = Math.min(distance, maxScroll() - 4);
            // Mandatory snap would fight the in-between frames; the hint ends
            // back at 0, which is a rest position, so nothing needs re-snapping.
            const snap = el.style.scrollSnapType;
            el.style.scrollSnapType = 'none';
            const start = performance.now();
            animating = true;

            // A finger during the hint takes over from wherever the row is.
            const stop = () => finish(false);

            const finish = (settled: boolean) => {
                animating = false;
                el.style.scrollSnapType = snap;
                el.removeEventListener('pointerdown', stop);
                activeHints.delete(el);
                if (settled) el.scrollLeft = 0;
                teardown();
            };

            const frame = (now: number) => {
                const t = Math.min(1, (now - start) / DURATION);
                // Cosine bell: eases out, peaks mid-way, eases back to rest.
                el.scrollLeft = travel * 0.5 * (1 - Math.cos(2 * Math.PI * t));
                if (t < 1) raf = requestAnimationFrame(frame);
                else finish(true);
            };

            el.addEventListener('pointerdown', stop);
            activeHints.set(el, stop);
            raf = requestAnimationFrame(frame);
        };

        // The user scrolling the row themselves is the discovery the hint
        // exists to cause - consume it. (Our own animation frames also fire
        // `scroll`; `animating` keeps them from consuming the flag mid-hint.)
        const onScroll = () => {
            if (!animating && !played() && el.scrollLeft > 1) {
                markPlayed();
                teardown();
            }
        };
        const onPointerDown = () => {
            pointerDown = true;
            window.clearTimeout(timer);
        };
        const onPointerUp = () => {
            pointerDown = false;
            if (intersecting) schedule();
        };

        if (played()) return;
        el.addEventListener('scroll', onScroll, { passive: true });
        el.addEventListener('pointerdown', onPointerDown);
        el.addEventListener('pointerup', onPointerUp);
        el.addEventListener('pointercancel', onPointerUp);
        observer.observe(el);

        return teardown;
    }, [ref, amount, distance, settleMs, groupKey]);
}
