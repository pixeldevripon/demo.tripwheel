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
 *
 * IT ALSO MARKS THE DOCUMENT. `body.hsdock` is the class the client's own
 * handoff specifies, and it is what lets the NAVBAR hide its mobile search icon
 * while the pill is docked - otherwise the two sit in the same band, one directly
 * under the other, and the page offers two ways to start the same search
 * (Pastel #51: "does not leave a second search bar behind"). A class beats
 * threading this through a context: the navbar is global, the hero is one page,
 * and they are otherwise strangers.
 */
export function useHeroDock(ref: RefObject<HTMLElement | null>): boolean {
    const [docked, setDocked] = useState(false);

    useEffect(() => {
        const hero = ref.current?.closest('section');
        if (!hero) return;

        const mq = window.matchMedia('(max-width: 767px)');

        const mark = (on: boolean) => {
            setDocked(on);
            document.body.classList.toggle('hsdock', on);
        };

        const update = () => {
            if (!mq.matches) {
                mark(false);
                return;
            }
            const bottom = hero.offsetTop + hero.offsetHeight - NAV_HEIGHT;
            mark(window.scrollY > bottom);
        };

        update();
        window.addEventListener('scroll', update, { passive: true });
        window.addEventListener('resize', update);
        mq.addEventListener('change', update);
        return () => {
            window.removeEventListener('scroll', update);
            window.removeEventListener('resize', update);
            mq.removeEventListener('change', update);
            // Navigating away from a destination page while docked would
            // otherwise leave the navbar's search icon hidden for good.
            document.body.classList.remove('hsdock');
        };
    }, [ref]);

    return docked;
}
