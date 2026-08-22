/** How much of each end the fade covers. */
const FADE = '40px';

/**
 * Tailwind classes that fade the ends of a horizontal scroller whose content is
 * still overflowing, so it reads as scrollable rather than clipped.
 *
 * A MASK, not a colour gradient. The rest of the site fades scroll tracks with
 * `bg-linear-to-r from-it-white`, which only works where the track sits on a
 * known, opaque surface. These rows do not: the tour tab bar is a translucent
 * blurred band (`--it-frow-bg` over whatever is scrolling behind it) and the
 * hero's Popular row sits on a photo. A colour gradient there paints a pale
 * smear over the backdrop; a mask fades the CONTENT to transparent and lets
 * whatever is behind show through, which is correct on any surface.
 *
 * Written out as complete class strings on purpose. Tailwind scans source text
 * for whole class names, so anything assembled from a template literal is never
 * generated and silently does nothing - a failure mode this exact utility has
 * already shipped once.
 *
 * `-webkit-mask-image` is still required for Safari.
 */
const MASK = {
  none: '',
  right: '[mask-image:linear-gradient(to_right,#000_calc(100%_-_40px),transparent)] [-webkit-mask-image:linear-gradient(to_right,#000_calc(100%_-_40px),transparent)]',
  left: '[mask-image:linear-gradient(to_right,transparent,#000_40px)] [-webkit-mask-image:linear-gradient(to_right,transparent,#000_40px)]',
  both: '[mask-image:linear-gradient(to_right,transparent,#000_40px,#000_calc(100%_-_40px),transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,#000_40px,#000_calc(100%_-_40px),transparent)]',
} as const;

/**
 * Pick the fade for the current scroll position. Both ends are independent, so
 * nothing is dimmed before there is something in that direction to reach - and
 * a row whose content fits gets no fade at all, which is what makes this safe
 * to apply unconditionally on desktop.
 *
 * Pair with `useScrollOverflow`, which reports the two booleans.
 */
export function edgeFadeMask(left: boolean, right: boolean): string {
  if (left && right) return MASK.both;
  if (right) return MASK.right;
  if (left) return MASK.left;
  return MASK.none;
}

/** Width of one fade, in px - callers keep content clear of it. */
export const EDGE_FADE_PX = Number.parseInt(FADE, 10);
