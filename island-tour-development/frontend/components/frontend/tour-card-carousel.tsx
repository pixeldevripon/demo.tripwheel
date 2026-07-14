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
                <div className='pointer-events-none absolute inset-x-4 top-1/2 z-10 flex -translate-y-1/2 items-center justify-between opacity-0 transition-opacity duration-300 group-hover:opacity-100'>
                    <motion.button
                        type='button'
                        onClick={step(-1)}
                        aria-label='Previous image'
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className='pointer-events-auto flex size-8 cursor-pointer items-center justify-center rounded-full border-none bg-it-white shadow-it-sm transition-colors duration-300 hover:bg-it-white/90'>
                        <Image
                            src='/icons/arrow-right-listings.svg'
                            alt=''
                            width={24}
                            height={24}
                            aria-hidden='true'
                        />
                    </motion.button>
                    <motion.button
                        type='button'
                        onClick={step(1)}
                        aria-label='Next image'
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className='pointer-events-auto flex size-8 cursor-pointer items-center justify-center rounded-full border-none bg-it-white shadow-it-sm transition-colors duration-300 hover:bg-it-white/90'>
                        <Image
                            src='/icons/arrow-right-listings.svg'
                            alt=''
                            className='rotate-180'
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
                    className='absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 opacity-0 transition-opacity duration-300 group-hover:opacity-100'>
                    {images.map((_, i) => (
                        <motion.div
                            key={i}
                            animate={{
                                width: i === index ? 26 : 8,
                                backgroundColor:
                                    i === index
                                        ? '#ffffff'
                                        : 'rgba(255, 255, 255, 0.6)',
                            }}
                            transition={{ duration: 0.2, ease: 'easeInOut' }}
                            className='h-2 rounded-full'
                        />
                    ))}
                </div>
            )}
        </>
    );
}
