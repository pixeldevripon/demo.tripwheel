/**
 * Canonical motion constants for the public site - the values proven on the
 * thank-you page (`thank-you-hero.tsx`) and checkout, now the sitewide
 * standard. Every new animation uses these; never re-declare local variants.
 *
 * The full interaction language:
 * - Press: `whileTap` scale DOWN with `springPop` - 0.9 for bare icons,
 *   0.94 for small tiles, 0.97-0.98 for buttons/pills/chips, 0.99 for large
 *   rows. NO hover scale-ups or lifts - hovers are color/opacity transitions.
 * - Indicator pops (check icons, radio dots, badges): scale 0 -> 1 with
 *   `springPop` inside `AnimatePresence`.
 * - Label/line swaps: `AnimatePresence mode='wait' initial={false}` +
 *   `swapFade` with y (or x) +-6 - enter from +6, exit to -6.
 * - Card/phase cross-fades: `crossFade` with y +-8 (enter +8, exit -8).
 * - Scroll/mount reveals: the reusable `Reveal` / `MountReveal` components
 *   with their own defaults - do not hand-roll.
 */

/** The one spring: icon pops, tap squashes, selection indicators, badges. */
export const springPop = { type: 'spring', stiffness: 500, damping: 30 } as const;

/** Quick directional fade for swapping labels/lines (pair with y or x +-6). */
export const swapFade = { duration: 0.15 } as const;

/** Card/phase cross-fade (pair with y +-8 inside AnimatePresence mode='wait'). */
export const crossFade = { duration: 0.2, ease: [0.4, 0, 0.2, 1] } as const;

/**
 * Attention shake for a required field the user skipped (the booking card's
 * departure row when Checkout is pressed with no time picked).
 *
 * Drive it IMPERATIVELY - `useAnimationControls().start({ x: shakeX })` from an
 * effect keyed on a click nonce. A declarative `animate={cond ? {x: shakeX} :
 * ...}` plays exactly once: the second press writes the same target, framer
 * sees no change, and nothing moves - which reads as a dead button precisely
 * when the user is already confused. Never `whileHover`-adjacent; this fires
 * on an explicit action only.
 */
export const shakeX = [0, -5, 5, -3, 3, 0];
export const shakeTransition = { duration: 0.35, ease: 'easeInOut' } as const;

/**
 * Sitewide page-enter (PageTransition): a whole page needs a longer, softer
 * settle than a card swap - same easing family as `Reveal` so route entrances
 * and section reveals feel like one system. Pair with y 16.
 */
export const pageEnter = {
    duration: 0.5,
    ease: [0.21, 0.47, 0.32, 0.98],
} as const;

/**
 * Dropdown/menu open-close (opens DOWNWARD). Variants-based: the panel springs
 * open and anything inside carrying `dropdownItemMotion` cascades in behind it;
 * closing is a fast clean fade so dismissal never feels laggy. Wrap the panel
 * in `AnimatePresence` and give it an `origin-top-*` class.
 */
export const dropdownMotion = {
    initial: 'closed',
    animate: 'open',
    exit: 'closed',
    variants: {
        open: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                ...springPop,
                staggerChildren: 0.03,
                delayChildren: 0.02,
            },
        },
        closed: {
            opacity: 0,
            y: -10,
            scale: 0.96,
            transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
        },
    },
} as const;

/**
 * Per-item cascade inside a `dropdownMotion` panel (inherits open/closed).
 *
 * `closed` carries its OWN transition on purpose. `AnimatePresence` holds the
 * panel in the DOM until every descendant has finished exiting, and without a
 * transition here the items fell back to framer's default spring - roughly
 * 800ms to settle `y`, against the panel's own 180ms. The whole menu sat there
 * fading long after the click, which is exactly the lag the panel's fast close
 * was meant to avoid. Shorter than the panel's, so items are gone first.
 */
const dropdownItemExit = { duration: 0.12, ease: [0.4, 0, 0.2, 1] } as const;

export const dropdownItemMotion = {
    variants: {
        open: { opacity: 1, y: 0, transition: springPop },
        closed: { opacity: 0, y: -6, transition: dropdownItemExit },
    },
} as const;

/** `dropdownMotion` mirrored for menus that open UPWARD (e.g. footer pills). */
export const dropdownUpMotion = {
    initial: 'closed',
    animate: 'open',
    exit: 'closed',
    variants: {
        open: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                ...springPop,
                staggerChildren: 0.03,
                delayChildren: 0.02,
            },
        },
        closed: {
            opacity: 0,
            y: 10,
            scale: 0.96,
            transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
        },
    },
} as const;

/** Per-item cascade inside a `dropdownUpMotion` panel (rises with it). */
export const dropdownUpItemMotion = {
    variants: {
        open: { opacity: 1, y: 0, transition: springPop },
        closed: { opacity: 0, y: 6, transition: dropdownItemExit },
    },
} as const;
