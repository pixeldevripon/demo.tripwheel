/**
 * Framer Motion powered in-page scrolling. Shared by every hash/anchor jump on
 * the public site (detail tab nav, "See all" links, ...) so they all use the same
 * eased animation instead of the browser's native jump / `scroll-behavior`.
 *
 * Client-only (touches `window`); import from Client Components / event handlers.
 */
import { animate } from 'framer-motion';

/** Eased scroll cubic-bezier - a soft ease-out that settles without overshoot. */
const SCROLL_EASE = [0.22, 1, 0.36, 1] as const;
const SCROLL_DURATION = 0.6;

/**
 * Smoothly scroll the window so the element with `id` sits `offset` px below the
 * viewport top (offset clears any sticky navbar / tab bar). No-op when the target
 * is missing. Set `reduce` (from `useReducedMotion`) to jump instantly for users
 * who prefer reduced motion.
 *
 * Resolves when the scroll animation completes - callers that suspend a
 * scrollspy during the programmatic scroll await this to release their lock.
 */
export function smoothScrollToId(
    id: string,
    offset = 0,
    reduce = false,
): Promise<void> {
    const el = document.getElementById(id);
    if (!el) return Promise.resolve();
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    return new Promise(resolve => {
        animate(window.scrollY, top, {
            duration: reduce ? 0 : SCROLL_DURATION,
            ease: SCROLL_EASE,
            onUpdate: v => window.scrollTo(0, v),
            onComplete: () => resolve(),
        });
    });
}
