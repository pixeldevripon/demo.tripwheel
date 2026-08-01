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
import type { Currency } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import type { PriceUnitKey } from '@/lib/tours/pricing-label';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
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
    /**
     * Peach card (master §B.63 + design v2 .tc.peach): the warm surface with
     * its hairline border. Position-based, applied by the LISTING (card #1 of
     * All Tours / curated persona lists, default sort only) - never set it
     * from tour data. Since design v2 this renders identically to
     * `highlighted`; both exist so listings keep expressing WHY the card is
     * marked (tint rule vs top placement).
     */
    tinted?: boolean;
    /**
     * Top-placement card (design v2 .tc.peach): the listing passes it for its
     * FIRST card only. Renders the peach surface + peach hairline border.
     */
    highlighted?: boolean;
    /**
     * Eager-load this card's first image as an LCP candidate. POSITION-BASED,
     * like `tinted`/`highlighted`: only the grid knows which cards are above
     * the fold, so only the grid may set it - and only for its first ROW.
     *
     * Defaults to false deliberately. This used to be hardcoded on, so every
     * card on every surface emitted `<link rel=preload fetchpriority=high>` -
     * 12 competing preloads on a listing page, plus below-fold related-tour
     * grids on the tour and thank-you pages. That does not make the real LCP
     * element arrive sooner; it makes it arrive later, by splitting the early
     * connection budget across images nobody is looking at yet.
     */
    priority?: boolean;
    /**
     * Design v2 mobile layout (<sm): a horizontal row card - image 40%,
     * content 60% (mockup 3.5 locked mobile card). Opt-in per LISTING: only
     * grids that stack cards full-width on mobile may set it; carousel
     * surfaces keep the vertical card.
     */
    mobileRow?: boolean;
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
    tinted = false,
    highlighted = false,
    priority = false,
    mobileRow = false,
}: TourCardProps) {
    const { isSaved, toggle } = useWishlist();
    const wishlisted = isSaved(tour.id);
    const isRemove = wishlistVariant === 'remove';
    const isRated = tour.rating !== undefined;
    const priceLabel = dict[tour.priceUnit];
    // Design v2 .tc.peach: the highlighted (first) / tinted card sits on the
    // warm peach surface with its hairline border; every other card is white
    // and flat, lifting 2px with the card-hover shadow.
    const peach = highlighted || tinted;

    const card = (
        <article
            aria-label={tour.title}
            className={cn(
                // @container: the card adapts its own typography to its width -
                // compact at ~172px (mobile carousel), full size in wide cells.
                '@container group flex h-full flex-col overflow-hidden rounded-it-md border will-change-transform transition-all duration-(--it-duration-sm) ease-(--it-ease) hover:-translate-y-0.5 hover:shadow-it-card-hover',
                peach
                    ? 'bg-it-peach border-it-peach-border'
                    : 'bg-it-white border-transparent hover:border-it-card-hover-border',
                mobileRow && 'max-sm:flex-row max-sm:border-it-divider',
                className,
            )}>
            {/* ── Image area ──────────────────────────────────────────────── */}
            <div
                className={cn(
                    // Mockup .tc .im: photo eases to 1.03 on card hover (260ms).
                    'relative aspect-3/2 w-full shrink-0 overflow-hidden rounded-t-[12px] bg-it-bg [&_img]:transition-transform [&_img]:duration-(--it-duration-md) [&_img]:ease-(--it-ease) group-hover:[&_img]:scale-[1.03]',
                    mobileRow &&
                        'max-sm:w-2/5 max-sm:aspect-auto max-sm:rounded-l-[12px] max-sm:rounded-tr-none',
                )}>
                <TourCardCarousel
                    images={tour.images}
                    alt={tour.title}
                    sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 384px'
                    priority={priority}
                />
                {/* Soft bottom scrim over the photo edge (design v2). */}
                <div className='pointer-events-none absolute inset-0 z-1 bg-[image:var(--it-scrim-tile)]' />
                {/* Badge (top-left) + Wishlist button (top-right) */}
                <div className='absolute inset-x-2.5 top-2.5 flex items-start justify-between gap-2 z-10'>
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
                        className='ml-auto flex size-[30px] @[220px]:size-[34px] shrink-0 items-center justify-center rounded-full bg-it-white/92 shadow-it-sm border-none cursor-pointer transition-transform duration-(--it-duration-xs) ease-(--it-ease) hover:scale-[1.08]'>
                        {isRemove ? (
                            <X
                                className='size-4 text-it-ink'
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
                                className='size-4 @[220px]:size-[17px]'
                                aria-hidden='true'
                            />
                        )}
                    </motion.button>
                </div>
            </div>

            {/* ── Card info (design v2 .tc .body) ─────────────────────────── */}
            <div
                className={cn(
                    'flex flex-1 min-w-0 flex-col gap-1 px-3 pt-2.5 pb-3 @[220px]:px-3.5 @[220px]:pt-3 @[220px]:pb-3.5',
                )}>
                {/* Rating row - amber star glyph + soft count (above title). */}
                {isRated && (
                    <div className='flex items-center gap-1.5 text-[10.5px] @[220px]:text-[12.5px] leading-[1.6]'>
                        <span className='font-bold text-it-star'>
                            ★ {tour.rating}
                        </span>
                        <span className='text-it-text-muted tabular-nums'>
                            ({tour.reviewCount?.toLocaleString()})
                        </span>
                    </div>
                )}

                {/* Tour title */}
                <h3 className='m-0 font-it-body font-bold text-[13px] @[220px]:text-[15.5px] leading-[1.3] tracking-[-0.005em] text-it-ink line-clamp-2 @[220px]:min-h-[2.6em]'>
                    {tour.title}
                </h3>

                {/* Meta column: duration, pickup (design v2 .tc .meta) */}
                <div className='flex flex-col items-start gap-[3px] text-[11px] @[220px]:text-[12.5px] leading-[1.6] text-it-text-muted'>
                    <span className='inline-flex items-center gap-1.5'>
                        <Image
                            src='/icons/meta-clock.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-3.5 shrink-0'
                            aria-hidden='true'
                        />
                        {tour.duration}
                    </span>

                    {tour.pickupAvailable && (
                        <span className='inline-flex items-center gap-1.5'>
                            <Image
                                src='/icons/meta-pickup.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-3.5 shrink-0'
                                aria-hidden='true'
                            />
                            {dict.pickupAvailable}
                        </span>
                    )}
                </div>

                {/* Foot: price + free cancellation (pinned to the bottom) */}
                <div className='mt-auto flex flex-col gap-[3px] pt-2'>
                    <div className='flex items-baseline flex-wrap gap-x-1 text-[11px] @[220px]:text-[12.5px] leading-[1.6] text-it-text-muted'>
                        <span>{dict.from}</span>
                        <span className='font-extrabold text-[14px] @[220px]:text-[17px] leading-[1.3] tracking-[-0.01em] text-it-ink tabular-nums'>
                            {tour.priceDisplay}
                        </span>
                        <span>{priceLabel}</span>

                        {tour.priceVaries && (
                            <>
                                <span
                                    className='mx-1 size-1 rounded-full bg-it-ink-muted/60 self-center flex-none'
                                    aria-hidden='true'
                                />
                                <span>{dict.priceVaries}</span>
                            </>
                        )}
                    </div>

                    {tour.freeCancellation && (
                        <p
                            className={cn(
                                'm-0 inline-flex items-center gap-1.5 text-[11px] @[220px]:text-[12.5px] font-semibold leading-[1.6] text-it-green-text',
                                // Mockup hides the note on the compact mobile
                                // row card - the price line closes the card.
                                mobileRow && 'max-sm:hidden',
                            )}>
                            <Image
                                src='/icons/check-green.svg'
                                alt=''
                                width={24}
                                height={24}
                                className='size-3.5 shrink-0'
                                aria-hidden='true'
                            />
                            {dict.freeCancellation}
                        </p>
                    )}
                </div>
            </div>
        </article>
    );

    // When the data source supplies a detail URL, the whole card links to the
    // tour page. The inner buttons call preventDefault/stopPropagation, so they
    // stay interactive without navigating.
    if (tour.href) {
        return (
            <Link
                href={tour.href}
                aria-label={tour.title}
                className='block h-full rounded-it-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary'>
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
 * cancellation note. Carries the same top-right wishlist heart as the
 * standard card (it stops propagation, so the card link never fires).
 */
function RankedTourCard({ tour, dict, className = '' }: TourCardProps) {
    const { isSaved, toggle } = useWishlist();
    const wishlisted = isSaved(tour.id);
    const [isHovered, setIsHovered] = useState(false);
    const rank = String(tour.rank).padStart(2, '0');
    const isRated = tour.rating !== undefined;
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
                    borderBottomLeftRadius: '0px',
                    borderBottomRightRadius: '0px',
                }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}>
                <TourCardCarousel
                    images={tour.images}
                    alt={tour.title}
                    sizes='(max-width: 640px) 50vw, (max-width: 1024px) 50vw, 384px'
                />
                {/* Rank badge (top-left) + Wishlist button (top-right) */}
                <div className='absolute inset-x-2.5 top-2.5 z-10 flex items-start justify-between gap-2 @[220px]:inset-x-4 @[220px]:top-4'>
                    <span className='grid size-8 place-items-center rounded-it-full bg-it-primary font-medium text-[12px] leading-[1.6] tracking-[-0.012em] text-it-white @[220px]:size-10 @[220px]:text-[16px]'>
                        {rank}
                    </span>
                    <motion.button
                        type='button'
                        aria-label={
                            wishlisted
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
                    </motion.button>
                </div>
            </motion.div>

            {/* Info */}
            <div
                className={cn(
                    'flex flex-col gap-2 px-2.5 @[220px]:gap-3 @[220px]:px-4',
                    !isRated && 'py-4'
                )}>
                {/* Rating - a taller fixed row than the standard card so it
                    breathes between the image and the title/description stack. */}
                {isRated && (
                    <div className='flex items-center gap-1.5  @[220px]:gap-2 @[220px]:h-7'>
                        <Image
                            src='/icons/star-listings.svg'
                            alt=''
                            width={16}
                            height={16}
                            className='size-3.5 shrink-0 @[220px]:size-4'
                            aria-hidden='true'
                        />
                        <span className='text-[10px] leading-[1.6] tracking-[-0.012em] text-it-heading @[220px]:text-[14px]'>
                            {tour.rating}{' '}
                            <span className='text-it-heading/50'>
                                ({tour.reviewCount?.toLocaleString()})
                            </span>
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

