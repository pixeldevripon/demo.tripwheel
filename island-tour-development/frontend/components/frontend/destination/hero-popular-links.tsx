'use client';

import Link from 'next/link';
import { useRef } from 'react';

import { useScrollOverflow } from '@/hooks/use-scroll-overflow';
import { cn } from '@/lib/utils';

import type { ActivityLink } from './lib/destination-hero.types';

/**
 * Edge fades as a MASK, not a colour gradient.
 *
 * The rest of the site fades scroll tracks with `bg-linear-to-r from-it-white`,
 * which works because those tracks sit on a known surface. This row sits on the
 * HERO PHOTO - a different colour on every island, and a different colour at
 * each end of the same row - so there is no colour to fade to. Masking fades the
 * text itself to transparent and lets the photo through underneath, which is the
 * only version that survives an arbitrary background.
 *
 * WRITTEN OUT IN FULL, not built from a `${FADE}` template. Tailwind scans
 * source text for complete class names; an interpolated one is never seen, so
 * the utility is never generated and the class silently does nothing - which is
 * exactly what shipped: the row was cut off with a hard edge and no fade.
 *
 * And `calc(100%_-_44px)`, not `calc(100%-44px)`: CSS calc REQUIRES whitespace
 * around `-`, so the tighter form is invalid and drops the whole declaration.
 * Two ways for this to fail silently, both of which it did.
 *
 * `-webkit-mask-image` is still required for Safari.
 */
const MASK = {
    none: '',
    right: '[mask-image:linear-gradient(to_right,#000_calc(100%_-_44px),transparent)] [-webkit-mask-image:linear-gradient(to_right,#000_calc(100%_-_44px),transparent)]',
    left: '[mask-image:linear-gradient(to_right,transparent,#000_44px)] [-webkit-mask-image:linear-gradient(to_right,transparent,#000_44px)]',
    both: '[mask-image:linear-gradient(to_right,transparent,#000_44px,#000_calc(100%_-_44px),transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,#000_44px,#000_calc(100%_-_44px),transparent)]',
} as const;

/**
 * The hero's "Popular:" quick links (master 5.2 locks the top 3).
 *
 * ONE LINE THAT SCROLLS ON MOBILE, not a wrapping paragraph: three island names
 * do not fit 375px, and wrapping pushed a second line of links over the hero
 * photo and down onto the fold. The client's own rule (S4h handoff,
 * `@media (max-width:767px)`) is `flex-wrap:nowrap; white-space:nowrap;
 * overflow-x:auto; justify-content:flex-start` - left-aligned, so the first link
 * starts where the eye already is rather than being centred with both ends cut
 * off. Desktop keeps the centred wrapping row, where three links fit anyway.
 *
 * A client leaf ON PURPOSE: the hero itself renders in the static shell (the
 * sitewide PageTransition animates it, and a hydration-started reveal on SSR
 * content flashes). Only the scroll measurement needs the browser, so only this
 * row is a client component.
 */
export function HeroPopularLinks({
    label,
    activities,
}: {
    /** "Popular" - the row's lead-in. */
    label: string;
    activities: ActivityLink[];
}) {
    const trackRef = useRef<HTMLDivElement>(null);
    // Self-gating: desktop wraps instead of scrolling, so there is no overflow
    // to report and no mask is applied there.
    const { left, right } = useScrollOverflow(trackRef);
    const mask = left && right ? 'both' : right ? 'right' : left ? 'left' : 'none';

    if (activities.length === 0) return null;

    return (
        <div
            ref={trackRef}
            className={cn(
                'flex w-full items-center gap-1.5 text-[13.5px] font-semibold leading-[1.6] text-it-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.3)]',
                'max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:whitespace-nowrap md:flex-wrap md:justify-center',
                '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                MASK[mask]
            )}>
            <span className='shrink-0'>{label}:</span>
            {activities.map((item, i) => (
                <span key={item.href} className='flex shrink-0 items-center gap-1.5'>
                    {i > 0 && (
                        <span aria-hidden='true' className='opacity-60'>
                            ·
                        </span>
                    )}
                    <Link
                        href={item.href}
                        className='text-it-white underline decoration-white/50 underline-offset-[3px] transition-colors duration-300 hover:text-it-primary-subtle'>
                        {item.label}
                    </Link>
                </span>
            ))}
        </div>
    );
}
