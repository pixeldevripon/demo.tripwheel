'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';
import { springPop } from '@/lib/motion';

/**
 * Shared card image carousel - the image area of every tour card variant
 * (shared TourCard, ranked collection card, hub trips card, hub pick card).
 * Renders the active image (hero first - the backend returns the card image
 * set hero-first) with a soft cross-fade on navigation, plus the hover-only
 * controls: prev/next arrows and the animated pagination dots.
 *
 * Drop it inside a `relative overflow-hidden bg-it-border` image container on
 * a card that carries the `group` class. The container's `bg-it-border` is the
 * sitewide image fallback (shows while loading / when a tour has no images);
 * the fade layers themselves stay transparent so images cross-fade into each
 * other, not into grey. The controls reveal via `group-hover`, so they
 * appear when the CARD is hovered (matching the listing design), not just the
 * image. With a single image the controls never render and the component is
 * just the image. Arrow/dot clicks stop propagation, so a card that is one
 * big link never navigates on carousel interaction.
 */
/*
 * Control sizing.
 *
 * The full-size values are the BASE and the narrow ones are `@max-[219px]`
 * overrides, deliberately that way round. Only some of the cards that use this
 * carousel put an `@container` on the image area; where there is no container
 * to measure, a container query simply never matches - so writing it as
 * "shrink below 220px" leaves those cards exactly as they are, while writing it
 * as "grow above 220px" would have silently shrunk them everywhere.
 *
 * 32px arrows with 16px insets eat 96px of a 144px mobile row-card photo, which
 * is what the founder flagged (2026-08-05).
 */
const INSET = 'inset-x-4 @max-[219px]:inset-x-1.5';
const ARROW =
    'pointer-events-auto flex size-8 @max-[219px]:size-[26px] cursor-pointer items-center justify-center rounded-full border-none bg-it-white shadow-it-sm transition-colors duration-300 hover:bg-it-white/90';
const ARROW_ICON = 'size-6 @max-[219px]:size-[18px]';
const DOTS_ROW = 'bottom-4 gap-1.5 @max-[219px]:bottom-2 @max-[219px]:gap-1';
const DOT = 'h-2 @max-[219px]:h-1.5';
/*
 * Scale utilities, not arbitrary values - `w-6.5` IS 26px (6.5 x the 4px
 * spacing unit) and `w-4.5` is 18px. Written as `w-[26px]` the base sorted
 * AFTER the container variant meant to override it, so the dots kept their full
 * width in a narrow photo while their heights shrank correctly. Both are on the
 * scale now, so they order the same way the heights already did. (Reaching for
 * `!` instead is a dead end: the trailing bang drops the container wrapper
 * altogether and the narrow width then applies at every size - measured.)
 */
const DOT_ACTIVE_W = 'w-6.5 @max-[219px]:w-4.5';
const DOT_IDLE_W = 'w-2 @max-[219px]:w-1.5';

export function TourCardCarousel({
    images,
    alt,
    sizes,
    priority = false,
}: {
    /** Hero-first image URL set (the backend caps it at 5). */
    images: string[];
    /** Base alt text - the active index is appended for multi-image sets. */
    alt: string;
    /** `next/image` responsive sizes for the card's grid slot. */
    sizes?: string;
    /** Mark the first image as LCP-priority (above-fold carousels). */
    priority?: boolean;
}) {
    const [index, setIndex] = useState(0);
    const count = images.length;
    const many = count > 1;

    const step = (dir: 1 | -1) => (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIndex(i => (i + dir + count) % count);
    };

    const src = images[index] ?? '';

    return (
        <>
            {/* Active image - keyed cross-fade on navigation. */}
            <AnimatePresence initial={false}>
                <motion.div
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
                    className='absolute inset-0'>
                    {src && (
                        <Image
                            src={src}
                            alt={many ? `${alt} - view ${index + 1}` : alt}
                            fill
                            sizes={sizes}
                            className='object-cover'
                            priority={priority && index === 0}
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Prev/next arrows - revealed on card hover. */}
            {many && (
                <div className={`pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-between opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${INSET}`}>
                    <motion.button
                        type='button'
                        onClick={step(-1)}
                        aria-label='Previous image'
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className={ARROW}>
                        <Image
                            src='/icons/arrow-right-listings.svg'
                            alt=''
                            width={24}
                            height={24}
                            className={ARROW_ICON}
                            aria-hidden='true'
                        />
                    </motion.button>
                    <motion.button
                        type='button'
                        onClick={step(1)}
                        aria-label='Next image'
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className={ARROW}>
                        <Image
                            src='/icons/arrow-right-listings.svg'
                            alt=''
                            className={`rotate-180 ${ARROW_ICON}`}
                            width={24}
                            height={24}
                            aria-hidden='true'
                        />
                    </motion.button>
                </div>
            )}

            {/* Pagination dots - revealed on card hover, active dot stretches. */}
            {many && (
                <div
                    aria-hidden='true'
                    className={`absolute left-1/2 z-10 flex -translate-x-1/2 items-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${DOTS_ROW}`}>
                    {images.map((_, i) => (
                        <span
                            key={i}
                            /* The stretch is a CSS transition rather than a
                               motion value: the active/idle widths differ per
                               container size, and a container query can only
                               reach a class, not an inline `animate` object.
                               Same 200ms ease-in-out as before. */
                            className={`rounded-full transition-[width,background-color] duration-200 ease-in-out ${DOT}
                                ${i === index ? `bg-it-white ${DOT_ACTIVE_W}` : `bg-it-white/60 ${DOT_IDLE_W}`}`}
                        />
                    ))}
                </div>
            )}
        </>
    );
}
