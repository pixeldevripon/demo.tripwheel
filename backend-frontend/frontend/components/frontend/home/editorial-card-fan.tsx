'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useRef, useState } from 'react';
import { MotionLink } from '../motion-link';
import { useClickOutside } from '../navbar/lib/use-click-outside';

type CategoryKey = 'buggy' | 'snorkel' | 'catamaran';

const CARDS: { key: CategoryKey; image: string }[] = [
    { key: 'buggy', image: '/images/home-page/categories/buggy-tours.jpg' },
    { key: 'snorkel', image: '/images/home-page/categories/snorkel-trips.jpg' },
    {
        key: 'catamaran',
        image: '/images/home-page/categories/catamaran-trips.jpg',
    },
];

/**
 * The three fan positions, straight from the mockup's `.edfig .stack`.
 *
 * Cards NEVER move (founder, 2026-08-05: "no need to changing position
 * animation"). Each one owns a slot for good; the only thing a click changes
 * is which card is on top - see `front` below. That also means the offsets can
 * be plain classes rather than animated values.
 *
 * Offsets are percentages of the stack, exactly as the mockup has them, so the
 * fan keeps its proportions as the band scales:
 *   desktop  1% / 29% / 57% of a stack 58% as wide as the band, 210px cards
 *   mobile   the existing centred offsets (founder: "mobile is fine as it is")
 */
const SLOTS = [
    { position: 'left-[calc(50%-140px)] top-3 lg:left-[1%]', rotate: -9 },
    { position: 'left-[calc(50%-78px)] top-0 lg:left-[29%]', rotate: -1 },
    { position: 'left-[calc(50%-16px)] top-3 lg:left-[57%]', rotate: 9 },
];

/** Stacking order when nothing has been clicked - middle card on top, as the mockup has it (c2 z-3). */
const DEFAULT_Z = [10, 30, 20];
/** The clicked card lifts above all three. */
const FRONT_Z = 40;
/** Travel curve for that lift - the same family as the site's other reveals. */
const LIFT_EASE = [0.21, 0.47, 0.32, 0.98] as const;

/**
 * The fanned category-card deck - the editorial banner's client leaf.
 *
 * The card is the mockup's `.c`: a white card, photo across the top 70%, then
 * a label carrying the category name and its starting price. (An earlier round
 * used a bare photo with the caption laid over it; the founder asked for the
 * mockup's card instead, 2026-08-05.)
 *
 * The deck is static. Clicking a card raises it above the others and nothing
 * else moves; a linked card navigates instead, since an admin who attached a
 * page asked for exactly that.
 */
export function EditorialCardFan({
    labels,
    cards,
}: {
    labels: Record<CategoryKey, string>;
    /**
     * Admin-configured cards, in fan order. Matched to slots by index, so a
     * short array (or an empty slot) leaves the remaining cards on their bundled
     * photo and label - the deck always renders three cards, whatever is
     * configured.
     *
     * `name` is the target page's own translated name and `priceFrom` its
     * already-formatted starting price in the shopper's currency (the frontend
     * never converts money). `href` is localized by the page; null means the
     * card is not a link.
     */
    cards?: {
        image: string;
        name: string | null;
        href: string | null;
        priceFrom?: string | null;
    }[];
}) {
    /*
     * Two pieces of state, because the click does two things with different
     * lifespans (founder, 2026-08-05: "do not reseting the z index just
     * scaling"):
     *
     *   front  - which card is on TOP. Sticky: bringing a card forward is the
     *            point of the click, so it stays forward until another is
     *            picked. null = the mockup's default order.
     *   lifted - which card is ZOOMED. Momentary: it is press feedback, so it
     *            relaxes as soon as attention moves elsewhere. Without this the
     *            card stayed enlarged for the rest of the visit.
     */
    const [front, setFront] = useState<number | null>(null);
    const [lifted, setLifted] = useState<number | null>(null);
    /*
     * A visitor who asked for less motion still gets the restack - that is the
     * information the click carries - but not the travel. Same treatment the
     * rest of the site's click-driven animations get.
     */
    const reduceMotion = useReducedMotion();
    const ref = useRef<HTMLDivElement>(null);
    /*
     * A pointerdown listener rather than the button's own `onBlur`: Safari does
     * not focus a <button> on click, so blur would simply never fire there -
     * and Safari is where this was reported. Only the zoom is released; the
     * stacking order is left exactly as the visitor set it.
     */
    useClickOutside(ref, () => setLifted(null), lifted !== null);

    return (
        <div
            ref={ref}
            /* Mockup `.edfig .stack`: right:14px, width:58% of the band, and
               BEHIND the copy (z-1 there, the text z-3). The z matters at the
               narrow end of desktop, where the leftmost card reaches under the
               headline and has to pass behind the words. */
            className='relative -mx-6 h-60 sm:-mx-10 lg:absolute lg:right-3.5 lg:top-1/2 lg:z-[1] lg:mx-0 lg:h-70 lg:w-[58%] lg:-translate-y-1/2'>
            {CARDS.map((card, i) => {
                const slot = SLOTS[i];
                const configured = cards?.[i];
                // Admin content wins; anything unset keeps the bundled card, so
                // a half-configured deck is coherent rather than half-blank.
                const title = configured?.name || labels[card.key];
                const href = configured?.href ?? null;
                const priceFrom = configured?.priceFrom ?? null;

                const surface = (
                    <>
                        {/* Mockup `.c img`: the photo is the top 70% of the
                            card, the label owns the rest. */}
                        <span className='relative block h-[70%] w-full shrink-0 overflow-hidden'>
                            <Image
                                src={configured?.image || card.image}
                                alt={title}
                                fill
                                sizes='(max-width: 1024px) 158px, 210px'
                                className='object-cover'
                                quality={100}
                            />
                        </span>
                        {/* Mockup `.lb` */}
                        <span className='block px-3 py-2.5 lg:px-[13px] lg:py-[11px]'>
                            <span className='block text-[13px] lg:text-[18px] font-medium leading-[1.6] text-it-ink tracking-[-0.012em]'>
                                {title}
                            </span>
                            {priceFrom && (
                                <span className='mt-[3px] block text-[12px] leading-[1.2] text-it-text-muted lg:text-[12px] tracking-[-0.012em]'>
                                    {priceFrom}
                                </span>
                            )}
                        </span>
                    </>
                );

                // Shared between the two element types so a card looks and
                // behaves identically whether or not an admin linked it.
                const isFront = front === i;
                const isLifted = lifted === i;
                const motionProps = {
                    /* z-index is a stacking value - it cannot tween, so the
                       swap would read as a hard pop on its own. The LIFT is
                       what carries the motion (founder, 2026-08-05: the z
                       change must be smooth): the promoted card eases up and
                       forward while the others settle back, and the z flips
                       under cover of that movement. */
                    style: {
                        zIndex: isFront ? FRONT_Z : DEFAULT_Z[i],
                        rotate: slot.rotate,
                    },
                    animate: reduceMotion
                        ? { scale: 1, y: 0 }
                        : { scale: isLifted ? 1.05 : 1, y: isLifted ? -8 : 0 },
                    whileTap: reduceMotion
                        ? undefined
                        : { scale: isLifted ? 1.03 : 0.98 },
                    transition: {
                        scale: { duration: 0.45, ease: LIFT_EASE },
                        y: { duration: 0.45, ease: LIFT_EASE },
                    },
                    /* Mockup `.c`: 210x280 (3/4) desktop, 158x210 mobile,
                       white, 18px radius, soft drop shadow, hairline white
                       border. */
                    /* `flex flex-col` is load-bearing: a <button>/<a> centres
                       its content, which left a 16px white band above the photo
                       and pushed the whole card off the mockup. The column
                       pins the photo to the top edge and lets the label take
                       the rest. */
                    className: `absolute flex h-[210px] w-[158px] flex-col overflow-hidden rounded-[12px] border border-it-white/75 bg-it-white p-0 text-left shadow-[0_24px_50px_rgba(0,0,0,0.28)] cursor-pointer lg:h-[280px] lg:w-[210px] lg:rounded-[18px] ${slot.position}`,
                } as const;

                /*
                 * A linked card is a real <a>, not a button that navigates: it
                 * has to be crawlable, middle-clickable and readable by a screen
                 * reader as a link to that page. Bringing it to the front is not
                 * its job - clicking it opens the page, which is what an admin
                 * asked for by linking it.
                 */
                if (href) {
                    return (
                        <MotionLink
                            key={card.key}
                            href={href}
                            aria-label={`Explore ${title}`}
                            {...motionProps}>
                            {surface}
                        </MotionLink>
                    );
                }

                return (
                    <motion.button
                        key={card.key}
                        type='button'
                        aria-label={`Bring ${title} to the front`}
                        aria-pressed={isFront}
                        onClick={() => {
                            setFront(i);
                            setLifted(i);
                        }}
                        {...motionProps}>
                        {surface}
                    </motion.button>
                );
            })}
        </div>
    );
}

