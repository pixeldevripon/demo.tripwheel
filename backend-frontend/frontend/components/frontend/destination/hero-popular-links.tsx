'use client';

import Link from 'next/link';
import { useRef } from 'react';

import { useScrollOverflow } from '@/hooks/use-scroll-overflow';
import { edgeFadeMask } from '@/lib/edge-fade';
import { cn } from '@/lib/utils';

import type { ActivityLink } from './lib/destination-hero.types';

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

    if (activities.length === 0) return null;

    return (
        <div
            ref={trackRef}
            className={cn(
                'flex w-full items-center gap-1.5 text-[12px] font-medium leading-[1.6] text-it-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.3)] tracking-[-0.012em]',
                'max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:whitespace-nowrap md:flex-wrap md:justify-center',
                '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
                edgeFadeMask(left, right)
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
                        className='text-it-white underline decoration-white/50 underline-offset-[3px] transition-colors duration-300 hover:text-it-primary-subtle tracking-[-0.012em]'>
                        {item.label}
                    </Link>
                </span>
            ))}
        </div>
    );
}
