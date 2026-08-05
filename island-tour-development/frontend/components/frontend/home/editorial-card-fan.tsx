'use client';

import { springPop } from '@/lib/motion';
import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { MotionLink } from '../motion-link';

type CategoryKey = 'buggy' | 'snorkel' | 'catamaran';

/** How often the deck shuffles one step (ms). Tune here. */
const CYCLE_MS = 6000;
/** How long one shuffle move travels (s) - higher = slower, calmer motion. */
const MOVE_DURATION_S = 1.4;
/** Shared easing for the shuffle travel + rotation. */
const MOVE_EASE = [0.21, 0.47, 0.32, 0.98] as const;

const CARDS: { key: CategoryKey; image: string }[] = [
    { key: 'buggy', image: '/images/home-page/categories/buggy-tours.jpg' },
    { key: 'snorkel', image: '/images/home-page/categories/snorkel-trips.jpg' },
    {
        key: 'catamaran',
        image: '/images/home-page/categories/catamaran-trips.jpg',
    },
];

/**
 * The three fan positions (left / middle / right-front). Position classes carry
 * the responsive offsets; rotation is animated via framer (a class rotation
 * would snap instead of turning smoothly during a shuffle).
 *
 * DESKTOP mirrors the mockup's `.edfig .stack` exactly: cards at 1% / 29% / 57%
 * of a stack 58% as wide as the band, rotated -9 / -1 / +9. Because the offsets
 * are percentages of that stack they scale with the band, which is the whole
 * point - on the 1152px container that lands the cards ~187px apart, so with a
 * 210px card they only overlap ~23px and read as almost side by side. They used
 * to be fixed 0 / 104 / 166px offsets, overlapping by 106px and 148px - far
 * more than the design, and unevenly (client, 2026-08-05).
 *
 * MOBILE is deliberately untouched (client: "mobile is fine as it is").
 */
const SLOTS = [
    { position: 'left-[calc(50%-140px)] top-3 lg:left-[1%]', rotate: -9, z: 10 },
    { position: 'left-[calc(50%-78px)] top-0 lg:left-[29%]', rotate: -1, z: 20 },
    {
        position: 'left-[calc(50%-16px)] top-3 lg:left-[57%]',
        rotate: 9,
        z: 30,
    },
];

/** The front slot (highest z) - the right card, matching the Figma default. */
const FRONT_SLOT = 2;

/**
 * The fanned category-card deck - the editorial banner's client leaf. The deck
 * slowly shuffles: every CYCLE_MS each card advances one slot (left -> middle ->
 * front -> left) with a calm MOVE_DURATION_S travel. Hovering pauses the cycle,
 * clicking a card brings it to the front, and reduced-motion users get a static
 * deck (click-to-front still works, without the travel animation).
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
     * `name` is an island's own translated name, so it is safe to render in any
     * locale. `href` is already localized by the page; null means this card is
     * not a link and keeps the click-to-front behaviour.
     */
    cards?: { image: string; name: string | null; href: string | null }[];
}) {
    // How many slots the deck has advanced; card i sits in slot (i + shift) % 3.
    const [shift, setShift] = useState(0);
    const [paused, setPaused] = useState(false);
    const reduceMotion = useReducedMotion();

    // setTimeout keyed on `shift` (not setInterval): any manual click resets
    // the clock, so the next auto-shuffle is always a full CYCLE_MS away.
    useEffect(() => {
        if (paused || reduceMotion) return;
        const timer = setTimeout(
            () => setShift(s => (s + 1) % SLOTS.length),
            CYCLE_MS
        );
        return () => clearTimeout(timer);
    }, [shift, paused, reduceMotion]);

    return (
        <div
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            /* Mockup `.edfig .stack`: right:14px, width:58% of the band, and
               BEHIND the copy (z-1 there, the text z-3). The z matters now that
               the deck is this wide - at the narrow end of desktop the leftmost
               card reaches under the headline, and it has to pass behind it
               rather than over it. */
            className='relative -mx-6 h-60 sm:-mx-10 lg:absolute lg:right-3.5 lg:top-1/2 lg:z-[1] lg:mx-0 lg:h-70 lg:w-[58%] lg:-translate-y-1/2'>
            {CARDS.map((card, i) => {
                const slotIndex = (i + shift) % SLOTS.length;
                const slot = SLOTS[slotIndex];
                const isFront = slotIndex === FRONT_SLOT;
                const configured = cards?.[i];
                // Admin content wins; anything unset keeps the bundled card, so
                // a half-configured deck is coherent rather than half-blank.
                const title = configured?.name || labels[card.key];
                const href = configured?.href ?? null;

                const surface = (
                    <>
                        <Image
                            src={configured?.image || card.image}
                            alt={title}
                            fill
                            sizes='(max-width: 1024px) 158px, 210px'
                            className='object-cover'
                            quality={100}
                        />
                        <span className='absolute inset-x-0 bottom-0 flex items-center justify-center bg-it-heading/30 py-2.5 font-semibold text-[13px] leading-[1.4] text-it-white lg:py-3 lg:text-[15px]'>
                            {title}
                        </span>
                    </>
                );

                // Shared between the two element types so a card looks and moves
                // identically whether or not an admin linked it.
                const motionProps = {
                    style: { zIndex: slot.z },
                    layout: !reduceMotion,
                    animate: { rotate: slot.rotate },
                    whileTap: { scale: 0.98 },
                    transition: {
                        // Slow, calm travel for the shuffle; snappy spring for
                        // the press feedback only.
                        layout: { duration: MOVE_DURATION_S, ease: MOVE_EASE },
                        rotate: { duration: MOVE_DURATION_S, ease: MOVE_EASE },
                        scale: springPop,
                    },
                    className: `absolute h-[210px] w-[158px] overflow-hidden rounded-[12px] border-none bg-it-border p-0 shadow-it-md cursor-pointer lg:h-[280px] lg:w-[210px] lg:rounded-it-lg ${slot.position}`,
                } as const;

                /*
                 * A linked card is a real <a>, not a button that navigates: it
                 * has to be crawlable, middle-clickable and readable by a screen
                 * reader as a link to that island. It therefore gives up
                 * click-to-front - clicking it goes to the island, which is what
                 * an admin asked for by linking it. The deck still shuffles on
                 * its own, and hovering still pauses that.
                 *
                 * The element type is fixed per card (its href does not change
                 * as the deck rotates), so nothing remounts mid-shuffle.
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
                        aria-label={`View ${title}`}
                        aria-pressed={isFront}
                        onClick={() =>
                            // Land this card in the front slot.
                            setShift(
                                (FRONT_SLOT - i + SLOTS.length) % SLOTS.length
                            )
                        }
                        {...motionProps}>
                        {surface}
                    </motion.button>
                );
            })}
        </div>
    );
}

