'use client';

/**
 * Shared tour card primitives - reusable across Destination Listings,
 * Search Results, Home Page carousels, and any future tour grid/list.
 *
 * Usage:
 *   import { TourCard, BadgeChip } from '@/components/frontend/tour-card';
 *   import type { TourListing, TourCardDict } from '@/components/frontend/tour-card';
 */

import { useWishlist } from '@/components/frontend/wishlist-provider';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { springPop } from '@/lib/motion';
import type { Currency } from '@/lib/constants/locales';
import type { PriceUnitKey } from '@/lib/tours/pricing-label';
import { TourBadgeChip, type TourBadge } from './tour-badge';
import { TourCardCarousel } from './tour-card-carousel';

// ── Dictionary type ─────────────────────────────────────────────────────────
export type TourCardDict = {
    new: string;
    likelyToSellOut: string;
    mostPopular: string;
    sponsored: string;
    pickupAvailable: string;
    freeCancellation: string;
    priceVaries: string;
    from: string;
    per: string;
    perGroup: string;
    perBoat: string;
    perVehicle: string;
    perAircraft: string;
    perPackage: string;
};

// ── Data types ──────────────────────────────────────────────────────────────
// Master §3.6 badge set (the single badge in the card's top-left slot). Derived
// by the backend `deriveTourBadge` and passed through unchanged - full logic in
// technical-doc/03-implementation/TOUR-BADGES.md. The type + chip UI live in the
// shared, self-contained `./tour-badge` module (reused by the dashboard).
export type { TourBadge };

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
    /** Display currency of `price`/`priceDisplay` (from the backend `money` object). */
    currency: Currency;
    /** Localized formatted "From" price incl. currency symbol, e.g. "$120" / "120 €". */
    priceDisplay: string;
    /** Price-unit i18n key: 'per' (per person) or a per-unit_type key ('perBoat' …). */
    priceUnit: PriceUnitKey;
    priceVaries?: boolean;
    freeCancellation?: boolean;
    /**
     * When set (1-based), the card renders the ranked collection variant
     * (Figma node 47433:2088): a surface card with a numbered badge, a short
     * description line, and a combined "duration · From $price" row. The image
     * carousel and wishlist button are omitted in this variant.
     */
    rank?: number;
    /** Short 1-2 line blurb - shown only in the ranked variant. */
    description?: string;
};

// ── BadgeChip ───────────────────────────────────────────────────────────────
interface BadgeChipProps {
    type: TourBadge;
    dict: Pick<
        TourCardDict,
        'new' | 'likelyToSellOut' | 'mostPopular' | 'sponsored'
    >;
    className?: string;
}

export function BadgeChip({ type, dict, className = '' }: BadgeChipProps) {
    if (!type) return null;
    // Localized label for this badge; the color/shape/sizing live in the shared chip.
    const label =
        type === 'sponsored'
            ? dict.sponsored
            : type === 'new'
              ? dict.new
              : type === 'likelyToSellOut'
                ? dict.likelyToSellOut
                : dict.mostPopular;

    return (
        <TourBadgeChip
            type={type}
            label={label}
            size='responsive'
            className={className}
        />
    );
}

// ── TourCard ────────────────────────────────────────────────────────────────
export interface TourCardProps {
    tour: TourListing;
    dict: TourCardDict;
    className?: string;
    /**
     * Top-right wishlist control. 'heart' (default) toggles save state on every
     * listing surface; 'remove' renders an X instead - used on the wishlist
     * page, where the card is by definition saved and the only action is
     * taking it out.
     */
    wishlistVariant?: 'heart' | 'remove';
}

/**
 * Tour card dispatcher. Renders the ranked collection variant when `tour.rank`
 * is set (Figma 47433:2088), otherwise the standard listing card used across
 * Destination Listings, Search, and Home carousels.
 */
export function TourCard(props: TourCardProps) {
    if (props.tour.rank != null) return <RankedTourCard {...props} />;

    return <DefaultTourCard {...props} />;
}

function DefaultTourCard({
    tour,
    dict,
    className = '',
    wishlistVariant = 'heart',
}: TourCardProps) {
    const { isSaved, toggle } = useWishlist();
    const wishlisted = isSaved(tour.id);
    const isRemove = wishlistVariant === 'remove';
    const [isHovered, setIsHovered] = useState(false);

    const priceLabel = dict[tour.priceUnit];

    const card = (
        <motion.article
            aria-label={tour.title}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            animate={{ backgroundColor: isHovered ? '#fdf6f0' : '#ffffff' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={[
                // @container: the card adapts its own typography to its width -
                // compact at ~172px (mobile carousel), full size in wide grid cells.
                '@container group flex flex-col rounded-[16px] @[220px]:rounded-[24px] overflow-hidden',
                className,
            ].join(' ')}>
            {/* ── Image area ──────────────────────────────────────────────── */}
            <motion.div
                className='relative aspect-[86/74] w-full shrink-0 overflow-hidden bg-it-border @[220px]:aspect-[64/45]'
                animate={{
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    borderBottomLeftRadius: isHovered ? '0px' : '16px',
                    borderBottomRightRadius: isHovered ? '0px' : '16px',
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <TourCardCarousel
                    images={tour.images}
                    alt={tour.title}
                    sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px'
                    priority
                />
                {/* Badge (top-left) + Wishlist button (top-right) */}
                <div className='absolute inset-x-4 top-4 flex items-start justify-between gap-2 z-10'>
                    <BadgeChip type={tour.badge} dict={dict} />

                    <motion.button
                        type='button'
                        aria-label={
                            isRemove || wishlisted
                                ? 'Remove from wishlist'
                                : 'Add to wishlist'
                        }
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggle(tour.id);
                        }}
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className='ml-auto flex size-8 @[220px]:size-10 shrink-0 items-center justify-center rounded-full bg-it-white shadow-it-sm border-none cursor-pointer transition-shadow duration-300 hover:shadow-it-md'>
                        {isRemove ? (
                            <X
                                className='size-4 @[220px]:size-5 text-it-heading'
                                strokeWidth={1.5}
                                aria-hidden='true'
                            />
                        ) : (
                            <Image
                                src={
                                    wishlisted
                                        ? '/icons/heart-filled.svg'
                                        : '/icons/heart-outline.svg'
                                }
                                alt=''
                                width={24}
                                height={24}
                                className='size-5 @[220px]:size-6'
                                aria-hidden='true'
                            />
                        )}
                    </motion.button>
                </div>
            </motion.div>

            {/* ── Card info ────────────────────────────────────────────────── */}
            <motion.div
                className={cn(
                    'flex flex-col gap-1 pt-3 pb-1 @[220px]:gap-3 @[220px]:pt-4 @[220px]:pb-5',
                    className
                )}
                animate={{
                    paddingLeft: isHovered ? 16 : 0,
                    paddingRight: isHovered ? 16 : 0,
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}>
                {/* Star rating row - always rendered to keep card heights consistent */}
                <div
                    className='flex items-center gap-1 h-4 @[220px]:gap-1.5 @[220px]:h-[22px]'
                    aria-hidden={tour.rating === undefined}>
                    {tour.rating !== undefined ? (
                        <>
                            <Image
                                src='/icons/star-listings.svg'
                                alt='Star'
                                width={16}
                                height={16}
                                className='size-4'
                                aria-hidden='true'
                            />
                            <span className='text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                {tour.rating}{' '}
                                <span className='text-it-heading/50'>
                                    ({tour.reviewCount?.toLocaleString()})
                                </span>
                            </span>
                        </>
                    ) : (
                        /* invisible spacer - same line-height, no content */
                        <span className='invisible select-none text-[14px] leading-[1.6]'>
                            &nbsp;
                        </span>
                    )}
                </div>

                {/* Tour title */}
                <h3 className='m-0 font-medium text-[12px] @[220px]:text-[16px] leading-[1.4] tracking-[-0.012em] text-it-heading line-clamp-2'>
                    {tour.title}
                </h3>

                {/* Duration · Pickup */}
                <div className='flex items-center flex-wrap'>
                    <span className='flex items-center gap-1'>
                        <Image
                            src='/icons/clock.svg'
                            alt=''
                            width={16}
                            height={16}
                            className='size-3 @[220px]:size-4'
                            aria-hidden='true'
                        />
                        <span className='text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                            {tour.duration}
                        </span>
                    </span>

                    {tour.pickupAvailable && (
                        <>
                            <span
                                className='mx-2 @[220px]:mx-3 size-1 rounded-full bg-it-heading/20 flex-none'
                                aria-hidden='true'
                            />
                            <span className='flex items-center gap-1'>
                                <Image
                                    src='/icons/car.svg'
                                    alt=''
                                    width={16}
                                    height={16}
                                    className='size-3 @[220px]:size-4'
                                    aria-hidden='true'
                                />
                                <span className='text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                    {dict.pickupAvailable}
                                </span>
                            </span>
                        </>
                    )}
                </div>

                {/* Price */}
                <div className='flex items-baseline flex-wrap gap-x-1'>
                    <span className='text-[10px] @[220px]:text-[12px] leading-[1.6] text-it-heading/50'>
                        {dict.from}
                    </span>
                    <span className='font-medium text-[12px] @[220px]:text-[16px] leading-[1.25] tracking-[-0.012em] text-it-ink'>
                        {tour.priceDisplay}
                    </span>
                    <span className='text-[10px] @[220px]:text-[12px] leading-[1.6] text-it-heading/50'>
                        {priceLabel}
                    </span>

                    {tour.priceVaries && (
                        <>
                            <span
                                className='mx-1 size-1 rounded-full bg-it-heading/20 self-center flex-none'
                                aria-hidden='true'
                            />
                            <span className='text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                {dict.priceVaries}
                            </span>
                        </>
                    )}
                </div>

                {/* Free cancellation */}
                {tour.freeCancellation && (
                    <p className='m-0 text-[10px] @[220px]:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
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

// ── RankedTourCard ────────────────────────────────────────────────────────────
/**
 * Ranked collection card (Figma node 47433:2088). A surface (#f8f8f8) card,
 * radius 24, with a numbered badge over the image carousel (hover-revealed
 * arrows + dots, like every tour card), then rating, title, a short
 * description, a combined "duration · From $price" row, and a free
 * cancellation note. No wishlist - the whole card links out.
 */
function RankedTourCard({ tour, dict, className = '' }: TourCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const rank = String(tour.rank).padStart(2, '0');

    const card = (
        // @container: the card adapts its own typography to its width - compact in
        // a 2-col mobile grid (~177px), full size in a wide desktop cell - mirroring
        // the shared <TourCard>. On hover it fills cream and the image's bottom
        // corners square off so it merges into the content (same as <TourCard>).
        <motion.article
            aria-label={tour.title}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            animate={{ backgroundColor: isHovered ? '#fdf6f0' : '#f8f8f8' }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className={cn(
                '@container group flex flex-col gap-3 overflow-hidden rounded-[16px] pb-3 @[220px]:gap-4 @[220px]:rounded-[24px] @[220px]:pb-4',
                className
            )}>
            {/* Image carousel + rank badge (top-left) */}
            <motion.div
                className='relative aspect-[384/270] w-full shrink-0 overflow-hidden bg-it-border'
                animate={{
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    borderBottomLeftRadius: isHovered ? '0px' : '16px',
                    borderBottomRightRadius: isHovered ? '0px' : '16px',
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <TourCardCarousel
                    images={tour.images}
                    alt={tour.title}
                    sizes='(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 384px'
                />
                <span className='absolute left-2.5 top-2.5 z-10 grid size-8 place-items-center rounded-it-full bg-it-primary font-medium text-[12px] leading-[1.6] tracking-[-0.012em] text-it-white @[220px]:left-4 @[220px]:top-4 @[220px]:size-10 @[220px]:text-[16px]'>
                    {rank}
                </span>
            </motion.div>

            {/* Info */}
            <div className='flex flex-col gap-2 px-2.5 @[220px]:gap-3 @[220px]:px-4'>
                {/* Rating */}
                {tour.rating !== undefined && (
                    <div className='flex items-center gap-1.5 @[220px]:gap-2'>
                        <Image
                            src='/icons/star-listings.svg'
                            alt=''
                            width={16}
                            height={16}
                            className='size-3.5 shrink-0 @[220px]:size-4'
                            aria-hidden='true'
                        />
                        <span className='text-[10px] leading-[1.6] tracking-[-0.012em] text-it-heading @[220px]:text-[14px]'>
                            {tour.rating} ({tour.reviewCount?.toLocaleString()})
                        </span>
                    </div>
                )}

                <div className='flex flex-col gap-1 @[220px]:gap-1.5'>
                    {/* Title + description */}
                    <div className='flex flex-col gap-1 @[220px]:gap-1.5'>
                        <h3 className='m-0 font-medium text-[12px] leading-[1.4] tracking-[-0.012em] text-it-heading @[220px]:text-[16px]'>
                            {tour.title}
                        </h3>
                        {tour.description && (
                            <p className='m-0 text-[10px] leading-[1.6] tracking-[-0.012em] text-it-heading line-clamp-2 @[220px]:text-[14px]'>
                                {tour.description}
                            </p>
                        )}
                    </div>

                    {/* Duration · From $price */}
                    <div className='flex items-center gap-2 @[220px]:gap-4'>
                        <span className='flex items-center gap-1'>
                            <Image
                                src='/icons/clock.svg'
                                alt=''
                                width={16}
                                height={16}
                                className='size-3.5 shrink-0 @[220px]:size-4'
                                aria-hidden='true'
                            />
                            <span className='text-[10px] leading-[1.6] tracking-[-0.012em] text-it-heading @[220px]:text-[14px]'>
                                {tour.duration}
                            </span>
                        </span>
                        <span
                            aria-hidden='true'
                            className='size-1 shrink-0 rounded-full bg-it-heading'
                        />
                        <span className='flex items-baseline gap-1'>
                            <span className='text-[10px] leading-[1.6] tracking-[-0.012em] text-it-heading @[220px]:text-[12px]'>
                                {dict.from}
                            </span>
                            <span className='font-medium text-[12px] leading-[1.6] tracking-[-0.012em] text-it-heading @[220px]:text-[16px]'>
                                {tour.priceDisplay}
                            </span>
                        </span>
                    </div>

                    {/* Free cancellation */}
                    {tour.freeCancellation && (
                        <p className='m-0 text-[10px] leading-[1.6] tracking-[-0.012em] text-it-heading @[220px]:text-[14px]'>
                            {dict.freeCancellation}
                        </p>
                    )}
                </div>
            </div>
        </motion.article>
    );

    if (tour.href) {
        return (
            <Link
                href={tour.href}
                aria-label={tour.title}
                className='block rounded-[16px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary @[220px]:rounded-[24px]'>
                {card}
            </Link>
        );
    }

    return card;
}

