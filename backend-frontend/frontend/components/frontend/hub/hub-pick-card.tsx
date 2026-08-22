'use client';

import { springPop } from '@/lib/motion';
import Image from 'next/image';
import { useState } from 'react';
import { MotionLink } from '../motion-link';
import { TourCardCarousel } from '../tour-card-carousel';

export type HubPickLabel = 'best' | 'popular' | 'families';

export type HubPick = {
    id: string;
    /** Flat tour detail URL (locale-prefixed); the Book CTA links to it. */
    href: string;
    label: HubPickLabel;
    /** Localized label text, e.g. "BEST OVERALL". */
    labelText: string;
    title: string;
    /** Omit to hide the rating - an unrated pick is not a 0-star pick. */
    rating?: number;
    reviewCount?: number;
    /** Boat type, e.g. "Yacht". */
    type: string;
    description: string;
    /** e.g. "Full day". */
    duration: string;
    /** Localized "from" price incl. currency symbol, e.g. "$140" / "2.200 €". */
    priceDisplay: string;
    /** Localized price-unit suffix (e.g. "/per boat" or "/per"); appended after the price. */
    priceUnit: string;
    /** Hero-first image set for the card carousel (quiet dots always, S4j). */
    images: string[];
};

export type HubPickCardDict = {
    from: string;
    bookTrip: string;
    learnMore: string;
    readLess: string;
    /** Carousel chevron aria-labels (S4j) - "Previous photo" / "Next photo". */
    prevPhotoAria: string;
    nextPhotoAria: string;
    /** The description slide's closing line - "Full details on the tour page". */
    fullDetails: string;
};

const LABEL_ICON: Record<HubPickLabel, string> = {
    best: '/icons/hub/pick-best.svg',
    popular: '/icons/hub/pick-popular.svg',
    families: '/icons/hub/pick-families.svg',
};

/**
 * Editorial "top pick" card (Figma node 48024:11563 desktop / 48539:15821
 * mobile): a split row - content (label chip · title · rating · description ·
 * price · Book this Trip) on the left, image on the right. Desktop shows the
 * full description; mobile clamps it with a "Learn More" / "Read Less" toggle.
 */
export function HubPickCard({
    pick,
    dict,
}: {
    pick: HubPick;
    dict: HubPickCardDict;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        // The card pads NOTHING, at any width. The photo runs to the card's own
        // edges and its radius clips the corners (`overflow-hidden`); all the
        // padding lives on the CONTENT column, so the two halves meet flush.
        //
        // Both halves changed together (founder, 2026-08-18). The photo was a
        // fixed 340px column inset inside the card's own `p-4`/`px-7`, which
        // left a white margin on all four sides of it - a picture pinned to a
        // page rather than the card's own face. It is now an even 50/50 split
        // that bleeds to the edge: `grid-cols-2`, no gap, no card padding.
        <article className='group grid items-stretch overflow-hidden rounded-it-lg border border-it-divider bg-it-white shadow-it-sm max-md:gap-0 md:grid-cols-2 md:gap-0'>
            {/* Content */}
            <div className='flex min-w-0 flex-col gap-4 max-md:order-2 max-md:p-4 md:px-7 md:py-[26px]'>
                <div className='flex flex-col gap-3 md:gap-6'>
                    {/* Label */}
                    <div className='flex items-center gap-2'>
                        <Image
                            src={LABEL_ICON[pick.label]}
                            alt=''
                            width={24}
                            height={24}
                            className='size-3 sm:size-5 shrink-0'
                        />
                        <span className='text-[12px] sm:text-[12px] text-[#858585] uppercase tracking-[-0.012em] leading-[1.6]'>
                            {pick.labelText}
                        </span>
                    </div>

                    <div className='flex flex-col gap-3 md:gap-5'>
                        {/* Title + rating */}
                        <div className='flex flex-col gap-0.5'>
                            <h3 className='m-0 text-[14.5px] sm:text-[20px]  leading-[1.2] tracking-[-0.012em] text-it-heading font-medium'>
                                {pick.title}
                            </h3>
                            <div className='flex items-center gap-4'>
                                {pick.rating !== undefined && (
                                    <>
                                        <span className='flex items-center gap-2'>
                                            <Image
                                                src='/icons/star-listings.svg'
                                                alt=''
                                                width={16}
                                                height={16}
                                                className='size-4 shrink-0'
                                            />
                                            <span className='text-[13px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                                {pick.rating}
                                                {pick.reviewCount !==
                                                    undefined &&
                                                    ` (${pick.reviewCount.toLocaleString()})`}
                                            </span>
                                        </span>
                                        <span className='size-1 shrink-0 rounded-full bg-it-heading/30' />
                                    </>
                                )}
                                <span className='text-[13px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                    {pick.type}
                                </span>
                            </div>
                        </div>

                        {/* Description + price */}
                        <div className='flex flex-col gap-3'>
                            <p
                                className={`m-0 max-w-[560px] text-[13px] leading-[1.65] text-it-text-muted ${
                                    expanded
                                        ? ''
                                        : 'line-clamp-3 md:line-clamp-none tracking-[-0.012em] leading-[1.6] it-text '
                                }`}>
                                {pick.description}
                            </p>
                            <button
                                type='button'
                                onClick={() => setExpanded(v => !v)}
                                className='-mt-1 self-start cursor-pointer border-none bg-transparent p-0 font-medium text-[13px] leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-4 transition-colors hover:text-it-primary md:hidden'>
                                {expanded ? dict.readLess : dict.learnMore}
                            </button>

                            {/* `text-it-white/70` on a white card - the duration
                                and the word "from" rendered white on white and
                                were invisible on every pick, which is why the
                                line read as a stray dot in front of a price.
                                Muted ink, matching the rating/type line above.

                                The dot is drawn only when there IS a duration
                                to separate from the price; unconditional, it
                                was the only visible thing left on the line. */}
                            <p className='m-0 flex items-center gap-4'>
                                {pick.duration && (
                                    <>
                                        <span className='text-[13px] leading-[1.6] text-it-heading/70 tabular-nums tracking-[-0.012em]'>
                                            {pick.duration}
                                        </span>
                                        <span className='size-[3px] shrink-0 rounded-full bg-it-ink-muted' />
                                    </>
                                )}
                                <span className='text-[13px] leading-[1.6] text-it-heading/70 tabular-nums tracking-[-0.012em]'>
                                    {dict.from}{' '}
                                    <b className='text-[13px] font-medium tracking-[-0.012em] text-it-heading'>
                                        {pick.priceDisplay}
                                    </b>
                                    {pick.priceUnit ? ` ${pick.priceUnit}` : ''}
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Book this Trip - outlined orange, links to the tour page */}
                <MotionLink
                    href={pick.href}
                    whileTap={{ scale: 0.98 }}
                    transition={springPop}
                    className='inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-it-full border-[1.5px] border-it-primary bg-transparent px-5 py-2.5 text-[12px] font-medium leading-[1.6] text-it-primary-hover no-underline transition-colors duration-(--it-duration-xs) hover:bg-it-primary-subtle md:w-auto md:self-start tracking-[-0.012em]'>
                    {dict.bookTrip}
                </MotionLink>
            </div>

            {/* Image carousel - quiet dots always, arrows on hover/focus (S4j).
                From md it fills its HALF of the card top to bottom: the row is
                `stretch` and the aspect ratio is dropped, so the photo tracks
                whatever height the copy sets. It used to be a fixed 16/10 box
                centred in its cell, which left a white band above and below it
                that grew with the description - and made two picks in the same
                list draw two different-sized photos. Below md the card is
                stacked, the photo leads, and the ratio is what gives it a
                height at all. `min-h` guards the short-copy case, where the
                content column alone would not give the row enough height. */}
            <div className='relative aspect-16/10 w-full shrink-0 overflow-hidden rounded-none bg-it-bg max-md:order-1 md:aspect-auto md:min-h-[212px]'>
                <TourCardCarousel
                    images={pick.images}
                    alt={pick.title}
                    sizes='(max-width: 768px) 42vw, 600px'
                    prevAria={dict.prevPhotoAria}
                    nextAria={dict.nextPhotoAria}
                    descSlide={{
                        title: pick.title,
                        description: pick.description,
                        linkLabel: dict.fullDetails,
                    }}
                />
            </div>
        </article>
    );
}

