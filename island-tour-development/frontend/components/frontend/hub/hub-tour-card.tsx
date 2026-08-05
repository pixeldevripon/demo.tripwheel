'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { Fragment } from 'react';

import { useWishlist } from '@/components/frontend/wishlist-provider';
import { springPop } from '@/lib/motion';
import { MotionLink } from '../motion-link';
import { TourCardCarousel } from '../tour-card-carousel';

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
    /** Hero-first image set for the hover carousel. */
    images: string[];
    badge: HubTourBadge;
    /** Omit to hide the rating row - an unrated tour is not a 0-star tour. */
    rating?: number;
    reviewCount?: number;
    title: string;
    /** Short attribute tags, dot-separated - e.g. ['8h','Yacht','Beach house']. */
    attributes: string[];
    /** Localized "from" price incl. currency symbol, e.g. "$140" / "2.200 €". */
    priceDisplay: string;
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
    sponsored: 'bg-[#f8f8f8] text-[#2c2c2c]',
    mostPopular: 'bg-it-primary text-it-white',
    likelyToSellOut: 'bg-[#193c5e] text-it-white',
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
    highlighted = false,
}: {
    tour: HubTour;
    dict: HubTourCardDict;
    /**
     * Pre-highlighted card (the panel's FIRST tour): static hover treatment -
     * cream fill + merged image + inset content. Static so nothing re-wraps.
     */
    highlighted?: boolean;
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
            className={`@container group flex h-full flex-col overflow-hidden rounded-it-md border will-change-transform transition-all duration-(--it-duration-md) ease-(--it-ease) hover:-translate-y-0.5 hover:shadow-it-card-hover max-sm:flex-row max-sm:min-h-[170px] ${
                highlighted
                    ? 'bg-it-peach border-it-peach-border'
                    : 'bg-it-white border-transparent hover:border-it-card-hover-border max-sm:border-it-divider'
            }`}>
            {/* Image - single photo, badge top-left + wishlist top-right. The
                bottom corners are ALWAYS squared so the image merges into the
                inset content area; only the card fill reacts to hover (mirrors
                the latest <TourCard>). */}
            <div className='relative aspect-3/2 w-full shrink-0 overflow-hidden rounded-t-[12px] bg-it-bg [&_img]:transition-transform [&_img]:duration-(--it-duration-md) [&_img]:ease-(--it-ease) group-hover:[&_img]:scale-[1.03] max-sm:w-2/5 max-sm:aspect-auto max-sm:rounded-l-[12px] max-sm:rounded-tr-none'>
                <TourCardCarousel
                    images={tour.images}
                    alt={tour.title}
                    sizes='(max-width: 640px) 40vw, (max-width: 1024px) 50vw, 384px'
                />
                {tour.images.length > 0 && (
                    <div className='pointer-events-none absolute inset-0 z-1 bg-[image:var(--it-scrim-tile)]' />
                )}
                <div className='pointer-events-none absolute inset-0 z-10 flex items-start justify-between p-2.5 md:p-4'>
                    {badgeLabel ? (
                        <span
                            className={`inline-flex min-w-0 items-center truncate rounded-[6px] px-[7px] py-[3px] text-[10px] font-bold leading-[1.5] @[220px]:px-[9px] @[220px]:py-[4px] @[220px]:text-[11.5px] ${BADGE_STYLE[tour.badge!]}`}>
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
                        className='pointer-events-auto grid size-[30px] shrink-0 cursor-pointer place-items-center rounded-it-full border-none bg-it-white/92 shadow-it-sm transition-transform duration-(--it-duration-xs) ease-(--it-ease) hover:scale-[1.08] @[220px]:size-[34px]'>
                        <Image
                            src={
                                saved
                                    ? '/icons/heart-filled.svg'
                                    : '/icons/heart-outline.svg'
                            }
                            alt=''
                            width={24}
                            height={24}
                            className='size-4 @[220px]:size-[17px]'
                        />
                    </motion.button>
                </div>
            </div>

            {/* Content - PERMANENT inset (mirrors the latest <TourCard>): the
                padding never animates, so hover only tints the card and nothing
                re-wraps or shifts. */}
            <div className='flex flex-1 min-w-0 flex-col gap-1 px-3 pt-2.5 pb-3 @[220px]:px-3.5 @[220px]:pt-3 @[220px]:pb-3.5'>
                {/* Rating - only when the tour actually has one. Rendering a
                    defaulted 0 here advertised a brand-new tour as "0 (0)",
                    which reads as a terrible tour rather than a new one. */}
                {tour.rating !== undefined && (
                    <div className='flex items-center gap-1.5 text-[10.5px] @[220px]:text-[12.5px] leading-[1.6]'>
                        <span className='font-bold text-it-star'>
                            ★ {tour.rating}
                        </span>
                        {tour.reviewCount !== undefined && (
                            <span className='text-it-text-muted tabular-nums'>
                                ({tour.reviewCount.toLocaleString()})
                            </span>
                        )}
                    </div>
                )}

                {/* Title + attribute tags */}
                <div className='flex flex-col gap-1 md:gap-1.5'>
                    <h3 className='m-0 font-it-body font-bold text-[13px] @[220px]:text-[15.5px] leading-[1.3] tracking-[-0.005em] text-it-ink line-clamp-2'>
                        {tour.title}
                    </h3>
                    <ul className='m-0 flex flex-wrap items-center gap-x-2 gap-y-1 p-0'>
                        {tour.attributes.map((attr, i) => (
                            <Fragment key={attr}>
                                {i > 0 && (
                                    <li
                                        aria-hidden='true'
                                        className='size-[3px] shrink-0 rounded-full bg-it-ink-muted'
                                    />
                                )}
                                <li className='text-[11px] @[220px]:text-[12.5px] leading-[1.6] text-it-text-muted'>
                                    {attr}
                                </li>
                            </Fragment>
                        ))}
                    </ul>
                </div>

                {/* Price - "from $140/per" or charter "from $2,200/10 people +
                    $220 per extra person" (Figma: unit sits flush to the price, the
                    surcharge note keeps its space and wraps on narrow cards). */}
                <p className='m-0 mt-auto pt-2 text-[11px] @[220px]:text-[12.5px] leading-[1.6] text-it-text-muted'>
                    {dict.from}
                    <b className='ml-1 text-[14px] @[220px]:text-[17px] font-bold tracking-[-0.01em] text-it-ink tabular-nums'>
                        {tour.priceDisplay}
                    </b>
                    <span className='ml-0.5'>
                        {tour.priceUnit}
                        {tour.priceNote ? ` ${tour.priceNote}` : ''}
                    </span>
                </p>

                {/* Free cancellation */}
                {tour.freeCancellation && (
                    <div className='flex items-center gap-1.5 text-[11px] @[220px]:text-[12.5px] font-semibold leading-[1.6] text-it-green-text max-sm:hidden'>
                        <Image
                            src='/icons/trust-check-green.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-[13px] shrink-0'
                        />
                        {dict.freeCancellation}
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

