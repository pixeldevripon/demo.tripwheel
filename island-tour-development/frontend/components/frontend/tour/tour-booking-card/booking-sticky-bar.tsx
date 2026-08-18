'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

import { useBooking } from '@/hooks/tours/use-booking';
import { useBookingCta } from '@/hooks/tours/use-booking-cta';
import { springPop, swapFade } from '@/lib/motion';
import { bookingUnitLabel } from '@/lib/tours/booking';

/**
 * The fixed navbar's height (`h-15 md:h-[72px]`). The card is already hidden behind
 * it before its box leaves the viewport, so the observer's top edge starts
 * below it - otherwise the bar arrives a beat late, while a strip of the card
 * the traveller cannot see is still technically "in view".
 *
 * The bar only exists on mobile, but the breakpoint is read rather than
 * assumed: the header steps to 80px at md (Figma 47042:2164), and a hard 64
 * would leave the observer 16px short on any tablet wide enough to cross it.
 */
const NAVBAR_HEIGHT_SM = 60;
const NAVBAR_HEIGHT_MD = 72;
const navbarHeight = () =>
    typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches
        ? NAVBAR_HEIGHT_MD
        : NAVBAR_HEIGHT_SM;

/**
 * The bar's entrance, shared with its spacer so the two move as one thing.
 * Matches the docked hero search pill (Pastel #51) - both are a bar arriving
 * from off screen to stand in for something that has scrolled away, and two
 * different curves for that would read as two different mechanisms.
 */
const barMotion = { duration: 0.22, ease: [0.21, 0.47, 0.32, 0.98] } as const;

/**
 * Mobile sticky "Check availability" bar (Pastel #37).
 *
 * On a phone the booking card is not a sticky rail - it sits in the flow after
 * the gallery and scrolls away, taking the price and the only way to book with
 * it. This puts them back: once the card has passed above the viewport, a
 * bottom-fixed bar carries the same headline price, the same free-cancellation
 * promise and the same action. The card itself does not move - this is an
 * addition.
 *
 * Three things are worth knowing about how it is built:
 *
 * - **It is portalled to `document.body`.** The card is wrapped in a framer
 *   `MountReveal`, and an animating ancestor's `transform` makes it the
 *   containing block for `position: fixed` descendants - the bar would be
 *   pinned to the bottom of the card instead of the screen for the length of
 *   the entrance. Out of the tree entirely, there is nothing to be relative to.
 *
 * - **Direction matters, not just visibility.** The card is equally "not
 *   intersecting" on the way DOWN to it, at the top of the page. Only above the
 *   viewport counts, or the bar greets every arrival by answering a question
 *   nobody has asked yet.
 *
 * - **It ships its own spacer.** A fixed bar covers the last 61-105px of the
 *   document, which is the footer. The spacer is a flow element in the same
 *   portal - so it lands AFTER the footer in the body - and is measured from
 *   the bar itself, giving the page exactly that height back at the bottom. It
 *   is measured rather than assumed because the bar's height is not one number:
 *   it depends on the locale (see the row below).
 *
 * Rendered below `lg` only: at `lg` and up the card is a sticky rail that never
 * leaves, so there is nothing to stand in for.
 *
 * Deliberately NO save heart. Pastel #37 offered one "if it still looks clean",
 * and on this row it does not - the row is already the tightest on the page,
 * and in five of the seven locales the CTA alone takes it to two lines. The
 * heart is one tap away on the hero photo (Pastel #36); the cancellation
 * promise is not (founder, 2026-08-06). No check glyph on that promise either,
 * for the same reason (founder, same day).
 */
export function BookingStickyBar({
    cardRef,
}: {
    /** The bordered booking card - the element whose visibility drives the bar. */
    cardRef: RefObject<HTMLDivElement | null>;
}) {
    const {
        dict,
        data,
        money,
        ready,
        fillPolicy,
        bookingBlocked,
        availabilityDeadEnd,
    } = useBooking();

    // Bringing the card back is the sticky bar's version of the in-card prompt:
    // the store's own "you still need a date" note is written above a button
    // that is currently off screen. `scroll-mt-*` on the card clears the fixed
    // navbar; the date field takes focus WITHOUT scrolling (a plain `focus()`
    // jumps the element into view instantly and cancels the glide).
    const { navigating, onCta } = useBookingCta({
        onIncomplete: () => {
            const card = cardRef.current;
            if (!card) return;
            card.scrollIntoView({ behavior: 'smooth', block: 'start' });
            card.querySelector<HTMLElement>(
                '[data-booking-date-trigger]'
            )?.focus({ preventScroll: true });
        },
    });

    // Portals need the DOM, so the first client render must still match the
    // server's (nothing).
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const [scrolledPast, setScrolledPast] = useState(false);
    useEffect(() => {
        const card = cardRef.current;
        if (!card) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                setScrolledPast(
                    !entry.isIntersecting &&
                        entry.boundingClientRect.top < navbarHeight()
                );
            },
            { rootMargin: `-${navbarHeight()}px 0px 0px 0px` }
        );
        observer.observe(card);
        return () => observer.disconnect();
    }, [cardRef]);

    // Measured rather than assumed: the bar is two lines of translated copy
    // beside a translated button, and a hardcoded height would under- or
    // over-shoot the footer clearance in five of the seven locales.
    const [bar, setBar] = useState<HTMLDivElement | null>(null);
    const [barHeight, setBarHeight] = useState(0);
    useEffect(() => {
        if (!bar) return;
        const measure = () => setBarHeight(bar.offsetHeight);
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(bar);
        return () => observer.disconnect();
    }, [bar]);

    // Nothing to stand in for: `operator_full` shows a disabled notice in place
    // of the CTA, and the all-sold-out dead end has no CTA at all.
    if (!mounted || bookingBlocked || availabilityDeadEnd) return null;

    const unitLabel = bookingUnitLabel(data, dict);
    // The card's cancellation line, flattened: its `{link}` phrase opens a modal
    // there, and a policy modal launched from a bar pinned over the footer is a
    // trap door. Here it is a statement.
    const cancellation = fillPolicy(dict.freeCancellation).replace(
        '{link}',
        fillPolicy(dict.freeCancellationLink)
    );

    return createPortal(
        <div className='lg:hidden'>
            {/* The footer clearance, GROWN WITH THE BAR rather than switched on
                with it. Toggling it outright moved the whole page by the bar's
                height in one frame while the bar was still sliding up - and on
                the very first appearance it moved twice, because the height is
                measured from the bar and is 0 until the bar exists. `initial={false}`
                so arriving already scrolled past (a reload, a back-navigation)
                does not animate the page open. */}
            <motion.div
                aria-hidden='true'
                initial={false}
                animate={{ height: scrolledPast ? barHeight : 0 }}
                transition={barMotion}
            />
            <AnimatePresence>
                {scrolledPast && (
                    <motion.div
                        key='booking-sticky-bar'
                        ref={setBar}
                        // Fades as well as slides, and on the site's own easing
                        // curve - the same entrance the docked hero pill uses,
                        // because they are the same idea: a bar arriving from
                        // off screen to stand in for something scrolled away.
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0 }}
                        transition={barMotion}
                        /* z-40 clears the page's own sticky bands (the tour tab
                           nav is z-30) and sits under every overlay: the filter
                           modal, the gallery lightbox and the navbar are z-100,
                           the policy modals z-200, and Cookiebot's banner is
                           higher still. Opaque, never translucent - a
                           see-through bar with content sliding under it is what
                           the client read as a gap on the tours page.
                           `env(safe-area-inset-bottom)` is 0 until the site
                           opts into `viewport-fit=cover`; it costs nothing now
                           and is the difference between clearing the iOS home
                           indicator and not on the day it does. */
                        className='fixed inset-x-0 bottom-0 z-40 border-t border-it-divider bg-it-white pb-[env(safe-area-inset-bottom)]'>
                        {/* Wraps only when it has to. "Check availability" is
                            18 characters in English and 27 in Dutch
                            ("Beschikbaarheid controleren"), so a row that fits
                            both halves at 390px in one locale cannot in
                            another - and the half that lost was the
                            cancellation promise, clipped to "Cancelación
                            gratuita hasta…". The price block claims a basis
                            wide enough for the longest translation of that
                            line; when the button no longer fits beside it,
                            flex-wrap drops the button onto its own row, where
                            `grow` makes it full width. No breakpoint can do
                            this - the trigger is the language, not the
                            viewport. */}
                        <div className='flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2'>
                            <div className='flex min-w-44 grow basis-44 flex-col gap-0.5'>
                                <span className='flex items-baseline gap-1 text-[11.5px] leading-[1.4] text-it-text-muted tracking-[-0.012em]'>
                                    <span>{dict.from}</span>
                                    <b className='text-[15.5px] font-medium leading-[1.2] tracking-[-0.012em] text-it-heading tabular-nums'>
                                        {money(data.priceFrom)}
                                    </b>
                                    <span className='truncate'>
                                        {unitLabel}
                                    </span>
                                </span>
                                {/* No check glyph. The card's trust rows earn
                                    one because they are a list of promises and
                                    the icon is what makes them scan as a set;
                                    a single line under a price is not a list,
                                    and the tick just crowded the tightest row
                                    on the page (founder, 2026-08-06). */}
                                <span className='truncate text-[11.5px] font-medium leading-[1.4] text-it-heading tracking-[-0.012em]'>
                                    {cancellation}
                                </span>
                            </div>

                            <motion.button
                                type='button'
                                onClick={onCta}
                                disabled={navigating}
                                aria-busy={navigating || undefined}
                                whileTap={
                                    navigating ? undefined : { scale: 0.98 }
                                }
                                transition={springPop}
                                className={`flex shrink-0 grow items-center justify-center whitespace-nowrap rounded-it-sm border-none bg-it-primary px-4 py-3 text-[13px] font-bold leading-[1.4] text-it-white transition-colors duration-(--it-duration-xs) hover:bg-it-primary-hover ${
                                    navigating
                                        ? 'cursor-default opacity-80'
                                        : 'cursor-pointer'
                                }`}>
                                <AnimatePresence mode='wait' initial={false}>
                                    <motion.span
                                        key={
                                            navigating
                                                ? 'navigating'
                                                : ready
                                                  ? 'continue'
                                                  : 'check'
                                        }
                                        initial={{ opacity: 0, y: 6 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={swapFade}
                                        className='inline-flex items-center justify-center gap-2'>
                                        {navigating && (
                                            <span
                                                aria-hidden
                                                className='inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent'
                                            />
                                        )}
                                        {ready
                                            ? dict.continue
                                            : dict.checkAvailability}
                                    </motion.span>
                                </AnimatePresence>
                            </motion.button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>,
        document.body
    );
}
