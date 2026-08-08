'use client';

import { useEffect, useState, type RefObject } from 'react';

/** Height of the fixed navbar the pill docks under. */
const NAV_HEIGHT = 64;

/**
 * True once the hero has scrolled past, on MOBILE ONLY - the cue to dock the
 * hero search pill under the navbar (Pastel #51, the handoff's "E behaviour").
 *
 * DESKTOP DELIBERATELY NEVER DOCKS. The navbar there already carries its own
 * persistent search pill on inner pages, so docking would put two search bars
 * on screen at once. On mobile that navbar pill is collapsed to an icon, which
 * is why the hero's own bar has to follow the visitor down instead.
 *
 * The threshold is the hero's own bottom edge minus the nav, resolved from the
 * DOM rather than hard-coded: the hero is a `clamp()` height that changes with
 * the viewport, so any constant here would be wrong on most screens.
 *
 * Measured on scroll AND resize, and re-measured rather than cached, because
 * the mobile URL bar collapsing changes the hero's rendered height mid-scroll.
 */
export function useHeroDock(ref: RefObject<HTMLElement | null>): boolean {
    const [docked, setDocked] = useState(false);

    useEffect(() => {
        const hero = ref.current?.closest('section');
        if (!hero) return;

        const mq = window.matchMedia('(max-width: 767px)');

        const update = () => {
            if (!mq.matches) {
                setDocked(false);
                return;
            }
            const bottom = hero.offsetTop + hero.offsetHeight - NAV_HEIGHT;
            setDocked(window.scrollY > bottom);
        };

        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        mq.addEventListener('change', update);
        return () => {
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
            mq.removeEventListener('change', update);
        };
    }, [ref]);

    return docked;
}
