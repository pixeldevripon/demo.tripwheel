'use client';

import { motion, useReducedMotion } from 'framer-motion';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { springPop } from '@/lib/motion';

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
    { key: 'catamaran', image: '/images/home-page/categories/catamaran-trips.jpg' },
];

/**
 * The three fan positions (left / middle / right-front). Position classes carry
 * the responsive offsets; rotation is animated via framer (a class rotation
 * would snap instead of turning smoothly during a shuffle).
 */
const SLOTS = [
    { position: 'left-[calc(50%-180px)] top-3 lg:left-0', rotate: -8, z: 10 },
    { position: 'left-[calc(50%-100px)] top-0 lg:left-35', rotate: 0, z: 20 },
    { position: 'left-[calc(50%-20px)] top-3 lg:left-56.5', rotate: 8, z: 30 },
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
    images,
}: {
    labels: Record<CategoryKey, string>;
    /**
     * Admin-chosen card photos, in fan order. Matched to cards by index, so a
     * short array (or an empty slot) leaves the remaining cards on their bundled
     * images - the deck always renders three cards, whatever is configured.
     */
    images?: string[];
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
            className='relative -mx-6 h-78 sm:-mx-10 lg:absolute lg:right-12 lg:top-1/2 lg:mx-0 lg:h-100 lg:w-130 lg:-translate-y-1/2'>
            {CARDS.map((card, i) => {
                const slotIndex = (i + shift) % SLOTS.length;
                const slot = SLOTS[slotIndex];
                const isFront = slotIndex === FRONT_SLOT;
                const title = labels[card.key];
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
                        style={{ zIndex: slot.z }}
                        layout={!reduceMotion}
                        animate={{ rotate: slot.rotate }}
                        whileTap={{ scale: 0.98 }}
                        transition={{
                            // Slow, calm travel for the shuffle; snappy spring
                            // for the press feedback only.
                            layout: { duration: MOVE_DURATION_S, ease: MOVE_EASE },
                            rotate: { duration: MOVE_DURATION_S, ease: MOVE_EASE },
                            scale: springPop,
                        }}
                        className={`absolute h-71 w-50 overflow-hidden rounded-[8px] border-none bg-it-border p-0 shadow-it-md cursor-pointer lg:h-100 lg:w-71.25 lg:rounded-[15px] ${slot.position}`}
                    >
                        <Image
                            src={images?.[i] || card.image}
                            alt={title}
                            fill
                            sizes='(max-width: 1024px) 200px, 285px'
                            className='object-cover'
                        />
                        <span className='absolute inset-x-0 bottom-0 flex items-center justify-center bg-it-heading/30 py-4 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-white lg:py-5 lg:text-[20px]'>
                            {title}
                        </span>
                    </motion.button>
                );
            })}
        </div>
    );
}
