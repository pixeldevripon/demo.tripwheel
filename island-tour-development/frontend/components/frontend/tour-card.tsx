'use client';

/**
 * Shared tour card primitives - reusable across Destination Listings,
 * Search Results, Home Page carousels, and any future tour grid/list.
 *
 * Usage:
 *   import { TourCard, BadgeChip } from '@/components/frontend/tour-card';
 *   import type { TourListing, TourCardDict } from '@/components/frontend/tour-card';
 */

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

// ── Dictionary type ─────────────────────────────────────────────────────────
export type TourCardDict = {
    new: string;
    likelyToSellOut: string;
    mostPopular: string;
    pickupAvailable: string;
    freeCancellation: string;
    priceVaries: string;
    from: string;
    per: string;
    perGroup: string;
};

// ── Data types ──────────────────────────────────────────────────────────────
export type TourBadge = 'new' | 'likelyToSellOut' | 'mostPopular' | null;

export type TourListing = {
    id: string;
    /**
     * Flat tour detail URL (locale-prefixed, e.g. `/en/curacao/{slug}`). When
     * set, the whole card becomes a link to the tour page. Built by the data
     * source (the inner wishlist / gallery controls stop propagation so they
     * never trigger navigation).
     */
    href?: string;
    /** Array of image paths for the hover-gallery slider */
    images: string[];
    badge: TourBadge;
    /** Omit to hide the star-rating row entirely */
    rating?: number;
    reviewCount?: number;
    title: string;
    /** e.g. "3 hours", "Full day" */
    duration: string;
    pickupAvailable: boolean;
    price: number;
    /** 'per' → "/per person"  |  'perGroup' → "/per group" */
    priceUnit: 'per' | 'perGroup';
    priceVaries?: boolean;
    freeCancellation?: boolean;
};

// ── BadgeChip ───────────────────────────────────────────────────────────────
interface BadgeChipProps {
    type: TourBadge;
    dict: Pick<TourCardDict, 'new' | 'likelyToSellOut' | 'mostPopular'>;
    className?: string;
}

export function BadgeChip({ type, dict, className = '' }: BadgeChipProps) {
    if (!type) return null;

    let label = '';
    let colorClass = '';

    if (type === 'new') {
        label = dict.new;
        // Figma: bg: #fdf6f0, text: #2c2c2c
        colorClass = 'bg-[#fdf6f0] text-[#2c2c2c]';
    } else if (type === 'likelyToSellOut') {
        label = dict.likelyToSellOut;
        // Figma: bg: rgb(25, 60, 94) / #193c5e, text: white
        colorClass = 'bg-[#193c5e] text-it-white';
    } else {
        label = dict.mostPopular;
        // Figma: bg: rgb(232, 97, 26) / #e8611a, text: white
        colorClass = 'bg-[#e8611a] text-it-white';
    }

    return (
        <span
            className={[
                'inline-flex items-center justify-center rounded-full',
                'h-6 px-2.5 text-[10px] @[220px]:h-8 @[220px]:px-[14px] @[220px]:text-[14px]',
                'font-normal leading-[1.4] tracking-[-0.012em]',
                colorClass,
                className,
            ].join(' ')}
        >
            {label}
        </span>
    );
}

// ── TourCard ────────────────────────────────────────────────────────────────
export interface TourCardProps {
    tour: TourListing;
    dict: TourCardDict;
    className?: string;
}

export function TourCard({ tour, dict, className = '' }: TourCardProps) {
    const [wishlisted, setWishlisted] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const [activeImageIndex, setActiveImageIndex] = useState(0);

    const priceLabel = tour.priceUnit === 'per' ? dict.per : dict.perGroup;

    // Handle gallery navigation
    const handlePrev = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (tour.images.length > 0) {
            setActiveImageIndex((prev) =>
                prev === 0 ? tour.images.length - 1 : prev - 1,
            );
        }
    };

    const handleNext = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (tour.images.length > 0) {
            setActiveImageIndex((prev) =>
                prev === tour.images.length - 1 ? 0 : prev + 1,
            );
        }
    };

    const activeImage = tour.images[activeImageIndex] || '';

    const card = (
        <motion.article
            aria-label={tour.title}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => {
                setIsHovered(false);
                setActiveImageIndex(0); // Reset to first image
            }}
            animate={{
                backgroundColor: isHovered ? '#fdf6f0' : '#ffffff',
            }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={[
                // @container: the card adapts its own typography to its width -
                // compact at ~172px (mobile carousel), full size in wide grid cells.
                '@container group flex flex-col rounded-[16px] @[220px]:rounded-[24px] overflow-hidden',
                className,
            ].join(' ')}
        >
            {/* ── Image area ──────────────────────────────────────────────── */}
            <motion.div
                className="relative aspect-[86/74] w-full shrink-0 overflow-hidden bg-it-border @[220px]:aspect-[64/45]"
                animate={{
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    borderBottomLeftRadius: isHovered ? '0px' : '16px',
                    borderBottomRightRadius: isHovered ? '0px' : '16px',
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
                {activeImage && (
                    <Image
                        src={activeImage}
                        alt={`${tour.title} - view ${activeImageIndex + 1}`}
                        fill
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px"
                        className="object-cover"
                        priority={activeImageIndex === 0}
                    />
                )}

                {/* Badge (top-left) + Wishlist button (top-right) */}
                <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2 z-10">
                    <BadgeChip type={tour.badge} dict={dict} />

                    <button
                        type="button"
                        aria-label={
                            wishlisted
                                ? 'Remove from wishlist'
                                : 'Add to wishlist'
                        }
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setWishlisted((v) => !v);
                        }}
                        className="ml-auto flex size-8 @[220px]:size-10 shrink-0 items-center justify-center rounded-full bg-it-white shadow-it-sm border-none cursor-pointer transition-all duration-150 active:scale-90 hover:shadow-it-md"
                    >
                        <Image
                            src={
                                wishlisted
                                    ? '/icons/heart-filled.svg'
                                    : '/icons/heart-outline.svg'
                            }
                            alt=""
                            width={24}
                            height={24}
                            className="size-5 @[220px]:size-6"
                            aria-hidden="true"
                        />
                    </button>
                </div>

                {/* Left/Right Slider Navigation (only on hover, animated smoothly) */}
                <AnimatePresence>
                    {isHovered && tour.images.length > 1 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex items-center justify-between z-10 pointer-events-none"
                        >
                            <button
                                type="button"
                                onClick={handlePrev}
                                aria-label="Previous image"
                                className="pointer-events-auto flex size-8 items-center justify-center rounded-full bg-it-white border-none cursor-pointer shadow-it-sm transition-all duration-150 hover:bg-it-white/90 active:scale-90"
                            >
                                <Image
                                    src="/icons/arrow-right-listings.svg"
                                    alt=""
                                    width={24}
                                    height={24}
                                  
                                    aria-hidden="true"
                                />
                            </button>
                            <button
                                type="button"
                                onClick={handleNext}
                                aria-label="Next image"
                                className="pointer-events-auto flex size-8 items-center justify-center rounded-full bg-it-white border-none cursor-pointer shadow-it-sm transition-all duration-150 hover:bg-it-white/90 active:scale-90"
                            >
                                <Image
                                    src="/icons/arrow-right-listings.svg"
                                    alt=""
                                   className='rotate-180'
                                    width={24}
                                    height={24}
                                    aria-hidden="true"
                                />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Pagination dots (only on hover, animated smoothly) */}
                <AnimatePresence>
                    {isHovered && tour.images.length > 1 && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.2 }}
                            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10"
                            aria-hidden="true"
                        >
                            {tour.images.map((_, i) => (
                                <motion.div
                                    key={i}
                                    layout
                                    animate={{
                                        width: i === activeImageIndex ? 26 : 8,
                                        height: 8,
                                        backgroundColor: i === activeImageIndex ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                                    }}
                                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                                    className="rounded-full"
                                />
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>

            {/* ── Card info ────────────────────────────────────────────────── */}
            <motion.div
                className={cn('flex flex-col gap-1 pt-3 pb-1 @[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5', className)}
                animate={{ paddingLeft: isHovered ? 16 : 0, paddingRight: isHovered ? 16 : 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
                {/* Star rating row - always rendered to keep card heights consistent */}
                <div className="flex items-center gap-1 h-4 @[220px]:gap-1.5 @[220px]:h-[22px]" aria-hidden={tour.rating === undefined}>
                    {tour.rating !== undefined ? (
                        <>
                            <Image
                                src="/icons/star-listings.svg"
                                alt="Star"
                                width={16}
                                height={16}
                                className="size-4"
                                aria-hidden="true"
                            />
                            <span className="text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70">
                                {tour.rating}{' '}
                                <span className="text-it-heading/50">
                                    ({tour.reviewCount?.toLocaleString()})
                                </span>
                            </span>
                        </>
                    ) : (
                        /* invisible spacer - same line-height, no content */
                        <span className="invisible select-none text-[14px] leading-[1.6]">&nbsp;</span>
                    )}
                </div>

                {/* Tour title */}
                <h3 className="m-0 font-medium text-[12px] @[220px]:text-[16px] leading-[1.4] tracking-[-0.012em] text-it-heading line-clamp-2">
                    {tour.title}
                </h3>

                {/* Duration · Pickup */}
                <div className="flex items-center flex-wrap">
                    <span className="flex items-center gap-1">
                        <Image
                            src="/icons/clock.svg"
                            alt=""
                            width={16}
                            height={16}
                            className="size-3 @[220px]:size-4"
                            aria-hidden="true"
                        />
                        <span className="text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70">
                            {tour.duration}
                        </span>
                    </span>

                    {tour.pickupAvailable && (
                        <>
                            <span
                                className="mx-2 @[220px]:mx-3 size-1 rounded-full bg-it-heading/20 flex-none"
                                aria-hidden="true"
                            />
                            <span className="flex items-center gap-1">
                                <Image
                                    src="/icons/car.svg"
                                    alt=""
                                    width={16}
                                    height={16}
                                    className="size-3 @[220px]:size-4"
                                    aria-hidden="true"
                                />
                                <span className="text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70">
                                    {dict.pickupAvailable}
                                </span>
                            </span>
                        </>
                    )}
                </div>

                {/* Price */}
                <div className="flex items-baseline flex-wrap gap-x-1">
                    <span className="text-[10px] @[220px]:text-[12px] leading-[1.6] text-it-heading/50">
                        {dict.from}
                    </span>
                    <span className="font-medium text-[12px] @[220px]:text-[16px] leading-[1.25] tracking-[-0.012em] text-it-ink">
                        ${tour.price}
                    </span>
                    <span className="text-[10px] @[220px]:text-[12px] leading-[1.6] text-it-heading/50">
                        {priceLabel}
                    </span>

                    {tour.priceVaries && (
                        <>
                            <span
                                className="mx-1 size-1 rounded-full bg-it-heading/20 self-center flex-none"
                                aria-hidden="true"
                            />
                            <span className="text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70">
                                {dict.priceVaries}
                            </span>
                        </>
                    )}
                </div>

                {/* Free cancellation */}
                {tour.freeCancellation && (
                    <p className="m-0 text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70">
                        {dict.freeCancellation}
                    </p>
                )}
            </motion.div>
        </motion.article>
    );

    // When the data source supplies a detail URL, the whole card links to the
    // tour page. The inner buttons call preventDefault/stopPropagation, so they
    // stay interactive without navigating.
    if (tour.href) {
        return (
            <Link
                href={tour.href}
                aria-label={tour.title}
                className='block rounded-[16px] @[220px]:rounded-[24px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
                {card}
            </Link>
        );
    }

    return card;
}
