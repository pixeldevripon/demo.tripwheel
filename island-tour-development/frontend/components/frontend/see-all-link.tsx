import Link from 'next/link';

import { cn } from '@/lib/utils';

/**
 * The sitewide "see all / all {destination} tours →" text link.
 *
 * ONE definition, because it was written out twice - the "Explore by type"
 * section head ("All Curaçao tours →") and the "Locals' favorites" footer CTA
 * ("See all 47 tours in Curaçao") - and the second copy had drifted into a
 * FILLED button that set `bg-it-primary` AND `text-it-primary`: orange on
 * orange, contrast ratio 1.0, completely unreadable. A colour sweep did that,
 * and a copy is exactly how a sweep gets to do it to one call site only.
 *
 * Figma (node 48506:21404) makes this a link, not a button: orange, underlined,
 * with a trailing arrow. The resting colour is `--it-primary-hover` rather than
 * the raw `--it-primary` from the mockup - that is what every other orange text
 * link on white already ships (category "you might like", the trust strip, the
 * thank-you related row) and the extra 12% of black is contrast we cannot
 * afford to give back on 13px text. Hover goes UP to `--it-primary`.
 *
 * ── The arrow nudge ─────────────────────────────────────────────────────────
 * Hover slides the arrow 4px right. It is a CSS `group-hover` transform, not
 * framer's `whileHover`: the sitewide rule is no `whileHover` (see
 * `lib/motion.ts`), and a pure-CSS hover keeps working before hydration and in
 * the server-rendered shell. `motion-safe:` gates the travel rather than a
 * `motion-reduce:` override, so under `prefers-reduced-motion: reduce` the
 * transform rule is never emitted at all and there is no cascade order to lose.
 * Timing is `--it-duration-md` (250ms) on `--it-ease-out`, not the 150ms
 * `--it-duration-sm` this shipped with: over a 4px travel that curve reads as a
 * snap rather than a glide. The travel is 6px for the same reason - under that
 * the movement registers as a twitch instead of a deliberate nudge.
 *
 * The arrow is a text glyph, not an `/icons/*.svg`: it has to follow the link's
 * colour through the hover transition, and a `next/image` SVG carries its fill
 * baked in. It is `aria-hidden` so the accessible name is just the label.
 */
export function SeeAllLink({
    href,
    label,
    className,
}: {
    href: string;
    /** Fully interpolated label - callers do their own `{count}`/`{destination}` replacement. */
    label: string;
    /** Placement/visibility only (e.g. `max-sm:hidden`). Not a restyle hook. */
    className?: string;
}) {
    return (
        <Link
            href={href}
            className={cn(
                'group inline-flex w-fit items-center gap-1.5 text-[13px] font-medium leading-[1.6] tracking-[-0.012em] text-it-primary-hover no-underline transition-colors duration-(--it-duration-md) ease-(--it-ease-out) hover:text-it-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary',
                className
            )}>
            {/* The underline sits on the label, not the link, so the arrow does
                not drag a rule along with it when it slides. */}
            <span className='underline underline-offset-[3px]'>{label}</span>
            <span
                aria-hidden='true'
                className='inline-block transition-[color,transform] duration-(--it-duration-md) ease-(--it-ease-out) motion-safe:group-hover:translate-x-1.5'>
                →
            </span>
        </Link>
    );
}
