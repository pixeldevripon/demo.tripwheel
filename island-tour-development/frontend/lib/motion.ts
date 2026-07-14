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
