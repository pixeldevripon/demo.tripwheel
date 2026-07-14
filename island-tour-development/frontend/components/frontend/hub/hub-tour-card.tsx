'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Fragment } from 'react';

import { useWishlist } from '@/components/frontend/wishlist-provider';
import { springPop } from '@/lib/motion';
import { MotionLink } from '../motion-link';

export type HubTourBadge =
    | 'sponsored'
    | 'mostPopular'
    | 'likelyToSellOut'
    | null;

export type HubTour = {
    id: string;
    /**
     * Flat tour detail URL (locale-prefixed, e.g. `/en/curacao/{slug}`). When
     * set, the whole card links to the tour page; the Save button stops
     * propagation so it never triggers navigation.
     */
    href?: string;
    /** Single hero image (no carousel in this card variant). */
    image?: string | null;
    badge: HubTourBadge;
    rating: number;
    reviewCount: number;
    title: string;
    /** Short attribute tags, dot-separated - e.g. ['8h','Yacht','Beach house']. */
    attributes: string[];
    price: number;
    /** e.g. "/per" or "/8 people". */
    priceUnit: string;
    /** Optional trailing note that wraps below on narrow cards, e.g. "+ $175 per extra person". */
    priceNote?: string;
    freeCancellation?: boolean;
};

export type HubTourCardDict = {
    badges: { sponsored: string; mostPopular: string; likelyToSellOut: string };
    from: string;
    freeCancellation: string;
    save: string;
};

// Badge background/text per type (Figma node 48024:11222).
const BADGE_STYLE: Record<Exclude<HubTourBadge, null>, string> = {
    sponsored: 'bg-it-surface text-it-heading',
    mostPopular: 'bg-it-primary text-it-white',
    likelyToSellOut: 'bg-[#193d5e] text-it-white',
};

/**
 * Hub trips card (Figma node 48024:11222 desktop / 48540:21220 mobile). Distinct
 * from the shared <TourCard>: single image (no carousel), an attribute tag row
 * (8h · Yacht · Beach house …) instead of duration/pickup, and a "from $X /per"
 * price. 3-col desktop / 2-col compact mobile.
 */
export function HubTourCard({
    tour,
    dict,
}: {
    tour: HubTour;
    dict: HubTourCardDict;
}) {
    const { isSaved, toggle } = useWishlist();
    const saved = isSaved(tour.id);
    const badgeLabel =
        tour.badge &&
        {
            sponsored: dict.badges.sponsored,
            mostPopular: dict.badges.mostPopular,
            likelyToSellOut: dict.badges.likelyToSellOut,
        }[tour.badge];

    const card = (
        <article
            aria-label={tour.title}
            className='group flex flex-col overflow-hidden rounded-[8px] bg-it-white transition-colors duration-300 ease-in-out hover:bg-[#fdf6f0] md:rounded-[16px]'>
            {/* Image - single photo, badge top-left + wishlist top-right. On hover
                the card fills cream and the image's bottom corners square off so it
                merges into the inset content area (mirrors <TourCard>). */}
            <div className='relative aspect-177/148 w-full shrink-0 overflow-hidden rounded-[8px] bg-it-border transition-[border-radius] duration-300 ease-in-out group-hover:rounded-b-none md:aspect-384/270 md:rounded-[16px]'>
                {tour.image && (
                    <Image
                        src={tour.image}
                        alt={tour.title}
                        fill
                        className='object-cover'
                    />
                )}
                <div className='absolute inset-0 flex items-start justify-between p-2.5 md:p-4'>
                    {badgeLabel ? (
                        <span
                            className={`inline-flex h-7 items-center rounded-it-full px-3 text-[10px] leading-[1.6] tracking-[-0.012em] md:h-8 md:px-3.5 md:text-[14px] ${BADGE_STYLE[tour.badge!]}`}>
                            {badgeLabel}
                        </span>
                    ) : (
                        <span />
                    )}
                    <motion.button
                        type='button'
                        onClick={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggle(tour.id);
                        }}
                        aria-label={dict.save}
                        aria-pressed={saved}
                        whileTap={{ scale: 0.9 }}
                        transition={springPop}
                        className='grid size-8 shrink-0 cursor-pointer place-items-center rounded-it-full border-none bg-it-white shadow-it-sm transition-shadow duration-300 hover:shadow-it-md md:size-10'>
                        <Image
                            src={
                                saved
                                    ? '/icons/heart-filled.svg'
                                    : '/icons/heart-outline.svg'
                            }
                            alt=''
                            width={24}
                            height={24}
                            className='size-5 md:size-6'
                        />
                    </motion.button>
                </div>
            </div>

            {/* Content - on hover it insets horizontally + gains bottom padding so
                the cream card wraps it (mirrors <TourCard>). The top padding stands
                in for the previous image->content gap. */}
            <div className='flex flex-col gap-1.5 pt-2 transition-[padding] duration-300 ease-in-out group-hover:px-3 group-hover:pb-3 md:gap-3 md:pt-4 md:group-hover:px-4 md:group-hover:pb-4'>
                {/* Rating */}
                <div className='flex items-center gap-2'>
                    <Image
                        src='/icons/star-listings.svg'
                        alt=''
                        width={16}
                        height={16}
                        className='size-4 shrink-0'
                    />
                    <span className='text-[10px] leading-[1.6] tracking-[-0.012em] text-it-heading/70 md:text-[14px]'>
                        {tour.rating} ({tour.reviewCount.toLocaleString()})
                    </span>
                </div>

                {/* Title + attribute tags */}
                <div className='flex flex-col gap-1 md:gap-1.5'>
                    <h3 className='m-0 font-medium text-[12px] leading-[1.6] tracking-[-0.012em] text-it-heading md:text-[16px]'>
                        {tour.title}
                    </h3>
                    <ul className='m-0 flex flex-wrap items-center gap-x-2 gap-y-1 p-0 md:gap-x-4'>
                        {tour.attributes.map((attr, i) => (
                            <Fragment key={attr}>
                                {i > 0 && (
                                    <li
                                        aria-hidden='true'
                                        className='size-1 shrink-0 rounded-full bg-it-heading/30'
                                    />
                                )}
                                <li className='text-[10px] leading-[1.6] tracking-[-0.012em] text-it-heading/70 md:text-[14px]'>
                                    {attr}
                                </li>
                            </Fragment>
                        ))}
                    </ul>
                </div>

                {/* Price - "from $140/per" or charter "from $2,200/10 people +
                    $220 per extra person" (Figma: unit sits flush to the price, the
                    surcharge note keeps its space and wraps on narrow cards). */}
                <p className='m-0 leading-[1.6] tracking-[-0.012em] text-it-heading'>
                    <span className='text-[10px] text-it-heading/70 md:text-[12px]'>
                        {dict.from}{' '}
                    </span>
                    <span className='font-medium text-[12px] md:text-[16px]'>
                        ${tour.price.toLocaleString()}
                    </span>
                    <span className='text-[10px] text-it-heading/70 md:text-[12px]'>
                        {tour.priceUnit}
                        {tour.priceNote ? ` ${tour.priceNote}` : ''}
                    </span>
                </p>

                {/* Free cancellation */}
                {tour.freeCancellation && (
                    <div className='flex items-center gap-2'>
                        <Image
                            src='/icons/check-green.svg'
                            alt=''
                            width={20}
                            height={20}
                            className='size-4 shrink-0 md:size-5'
                        />
                        <span className='text-[10px] leading-[1.6] tracking-[-0.012em] text-it-heading md:text-[14px]'>
                            {dict.freeCancellation}
                        </span>
                    </div>
                )}
            </div>
        </article>
    );

    // When the data source supplies a detail URL, the whole card links to the
    // tour page (the Save button stops propagation so it stays interactive).
    if (tour.href) {
        return (
            <MotionLink
                href={tour.href}
                aria-label={tour.title}
                className='block rounded-[8px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-it-primary md:rounded-[16px]'>
                {card}
            </MotionLink>
        );
    }

    return card;
}

