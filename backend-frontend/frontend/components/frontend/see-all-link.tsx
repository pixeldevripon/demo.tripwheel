'use client';

import { useState } from 'react';

import { motion } from 'framer-motion';

import { springPop } from '@/lib/motion';
import { cn } from '@/lib/utils';

import { MotionLink } from './motion-link';

/**
 * The sitewide "see all / all {destination} tours →" text link.
 *
 * Two shapes: inline (beside a section title) and `rule` - centred on a
 * hairline that runs the full width, which is how a section-closing CTA reads
 * as an ending rather than as another item in the list.
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
 * Hover springs the arrow 6px right, driven by framer-motion on `springPop` -
 * the sitewide spring - rather than a CSS transition.
 *
 * TWO things to know before touching this.
 *
 * 1. It is deliberately NOT the `whileHover` prop. Hover state is held in React
 *    and fed to `animate`, so the motion is a normal state transition. The
 *    practical difference is that `whileHover` fires on any pointer that
 *    reports hover, including a touch's synthetic one, which leaves the arrow
 *    stuck out after a tap on mobile; `onHoverStart/End` is pointer-aware and
 *    releases.
 *
 * 2. This reinstates a nudge that was purged sitewide on 2026-07-14 under the
 *    "hovers are colour only" rule - this exact CTA is named in that sweep.
 *    It is back on the founder's explicit instruction (2026-08-18), and ONLY
 *    here. The sibling arrows it was stripped from (category "you might like",
 *    editorial CTA, tour reviews "see all") are still colour-only, so the site
 *    is currently inconsistent by design pending a decision to roll this out.
 *
 * A CSS version shipped first and looked broken for a reason worth recording:
 * Tailwind v4's `translate-x-*` sets the standalone `translate` property, not
 * `transform`, so `transition-[...,transform]` matched nothing and the arrow
 * jumped the full distance on frame one. No duration or curve was ever in play.
 *
 * The arrow is a text glyph, not an `/icons/*.svg`: it has to follow the link's
 * colour through the hover transition, and a `next/image` SVG carries its fill
 * baked in. It is `aria-hidden` so the accessible name is just the label.
 *
 * A muted lead-in ("Not what you were after?") goes in `prefix`, which renders
 * BESIDE the link. This used to be `children`, which put it inside the anchor -
 * the whole sentence became clickable and the link's accessible name became the
 * sentence plus the CTA, so a screen reader announced a paragraph where the
 * visual design shows a short link. `prefix` is the only shape this slot ever
 * wanted; nothing else ever passed children.
 */
export function SeeAllLink({
    href,
    label,
    className,
    rule = false,
    prefix,
}: {
    href: string;
    /** Fully interpolated label - callers do their own `{count}`/`{destination}` replacement. */
    label: string;
    /** Placement/visibility only (e.g. `max-sm:hidden`). Not a restyle hook. */
    className?: string;
    /**
     * Centre the link on a full-width hairline, rules running out to both
     * edges. For a CTA that closes a section on its own; the inline variant is
     * for one sitting beside a section title.
     */
    rule?: boolean;
    /**
     * Muted lead-in rendered immediately before the link and OUTSIDE it, so it
     * is neither clickable nor part of the accessible name.
     */
    prefix?: React.ReactNode;
}) {
    const [hovered, setHovered] = useState(false);

    const link = (
        <MotionLink
            href={href}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            whileTap={{ scale: 0.98 }}
            transition={springPop}
            className={cn(
                'inline-flex w-fit items-center gap-1.5 text-[13px] font-medium leading-[1.6] tracking-[-0.012em] text-it-primary-hover no-underline transition-colors duration-(--it-duration-md) ease-(--it-ease-out) hover:text-it-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary',
                className
            )}>
            {/* The underline sits on the label, not the link, so the arrow does
                not drag a rule along with it when it slides. */}
            <span className='underline underline-offset-[3px]'>{label}</span>
            <motion.span
                aria-hidden='true'
                className='inline-block'
                animate={{ x: hovered ? 6 : 0 }}
                transition={springPop}>
                →
            </motion.span>
        </MotionLink>
    );

    // The lead-in sits beside the link on a tight 6px gap - the rule row's own
    // gap-4 is the air around the RULES, not between two bits of running text.
    const row = prefix ? (
        <span className='inline-flex items-center gap-1.5'>
            {prefix}
            {link}
        </span>
    ) : (
        link
    );

    if (!rule) return row;

    // `min-w-0` on the rules so a long label never pushes them off the row;
    // aria-hidden because they are decoration, not a separator the reader needs.
    return (
        <div className='flex w-full items-center gap-4'>
            <span aria-hidden className='h-px min-w-0 flex-1 bg-it-divider' />
            {row}
            <span aria-hidden className='h-px min-w-0 flex-1 bg-it-divider' />
        </div>
    );
}

