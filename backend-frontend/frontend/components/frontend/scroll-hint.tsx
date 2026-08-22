'use client';

import { cancelScrollHint, useScrollHintNudge } from '@/hooks/use-scroll-hint-nudge';
import { nearestStopIndex, resolveSnapStops } from '@/lib/scroll-stops';
import { springPop } from '@/lib/motion';
import { motion } from 'framer-motion';
import * as React from 'react';

/**
 * Platform horizontal scroller with the sitewide announce-itself behaviours
 * (mck-16 §4.6 + §4.8): the one-shot sideways nudge when the row first enters
 * view, and - opt-in via `dots` - a position indicator under the row showing
 * where the visitor is and how many rest positions there are.
 *
 * It renders YOUR scroller div (className passes through verbatim, children
 * untouched), so server components adopt it by swapping their overflow div's
 * tag; layout, snap and breakpoint behaviour stay in the caller's classes.
 * Client components that already hold a ref can use `useScrollHintNudge`
 * directly instead.
 *
 * Dots count REST POSITIONS, not items: mark each snap column with
 * `data-scroll-stop` (offsets are read from the DOM and collapsed via
 * `resolveSnapStops`); unmarked rows fall back to viewport-width pages. The
 * indicator renders only while the row actually scrolls - a 2-column table
 * that fits, or the desktop grid form of a mobile rail, shows nothing.
 *
 * Each dot is a button that scrolls the row to its rest position (instant
 * under `prefers-reduced-motion`, smooth otherwise). The active dot follows
 * the scroll itself, so swipes and dot taps stay in one source of truth.
 */
export function ScrollHintRow({
    children,
    className,
    dots = false,
    dotsClassName = 'flex items-center justify-center pt-1 pb-0.5',
    groupId,
}: {
    children: React.ReactNode;
    /** Classes for the scrolling element itself (overflow, snap, gap, ...). */
    className?: string;
    /** Render the position indicator under the row (mck-16 §4.6). */
    dots?: boolean;
    /** Layout of the indicator row (spacing/alignment overrides). */
    dotsClassName?: string;
    /** Share one nudge across sibling rows - see `useScrollHintNudge`. */
    groupId?: string;
}) {
    const ref = React.useRef<HTMLDivElement>(null);
    useScrollHintNudge(ref, { groupId });

    const [stops, setStops] = React.useState<number[]>([]);
    const [active, setActive] = React.useState(0);

    React.useEffect(() => {
        if (!dots) return;
        const el = ref.current;
        if (!el) return;

        let current: number[] = [];

        const onScroll = () =>
            setActive(nearestStopIndex(current, el.scrollLeft));

        const measure = () => {
            const maxScroll = el.scrollWidth - el.clientWidth;
            const marked = el.querySelectorAll<HTMLElement>('[data-scroll-stop]');
            // Marked columns rest where their left edge meets the scrollport's
            // snap edge (after scroll-padding); unmarked rows page by width.
            const padLeft =
                Number.parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0;
            const origin = el.getBoundingClientRect().left - el.scrollLeft;
            const marks =
                marked.length > 0
                    ? Array.from(marked, m => m.getBoundingClientRect().left - origin - padLeft)
                    : Array.from(
                          { length: Math.ceil(maxScroll / Math.max(1, el.clientWidth)) + 1 },
                          (_, i) => i * el.clientWidth
                      );
            current = resolveSnapStops(marks, maxScroll);
            setStops(current);
            onScroll();
        };

        measure();
        el.addEventListener('scroll', onScroll, { passive: true });
        // Viewport resizes move every stop; content changes (locale swap,
        // images sizing in) move the right edge without firing `scroll`.
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        for (const child of el.children) observer.observe(child);

        return () => {
            el.removeEventListener('scroll', onScroll);
            observer.disconnect();
        };
    }, [dots]);

    // Scroll the row to a rest position. A live hint animation yields first -
    // navigation and the announcement must never fight over `scrollLeft`. The
    // active dot is NOT set eagerly: the scroll listener flips it as the row
    // passes the midpoint, so taps and swipes share one source of truth.
    const goTo = (i: number) => {
        const el = ref.current;
        if (!el) return;
        cancelScrollHint(el);
        el.scrollTo({
            left: stops[i],
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
                .matches
                ? 'auto'
                : 'smooth',
        });
    };

    return (
        <>
            <div ref={ref} className={className}>
                {children}
            </div>
            {dots && stops.length > 0 && (
                <div className={dotsClassName}>
                    {stops.map((stop, i) => (
                        /* Button box is the touch target (28px tall, 3px side
                           insets); the visual dot stays the 6px house pill. */
                        <motion.button
                            key={stop}
                            type='button'
                            onClick={e => {
                                e.stopPropagation();
                                goTo(i);
                            }}
                            aria-label={`Go to position ${i + 1} of ${stops.length}`}
                            aria-current={i === active ? 'true' : undefined}
                            whileTap={{ scale: 0.9 }}
                            transition={springPop}
                            className='flex h-7 cursor-pointer items-center border-none bg-transparent p-0 px-[3px]'>
                            <span
                                className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ease-in-out ${
                                    i === active
                                        ? 'w-4.5 bg-it-primary'
                                        : 'w-1.5 bg-it-border'
                                }`}
                            />
                        </motion.button>
                    ))}
                </div>
            )}
        </>
    );
}
