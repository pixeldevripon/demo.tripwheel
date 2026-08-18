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
        <article className='group grid items-center gap-4 rounded-it-lg border border-it-divider bg-it-white p-4 shadow-it-sm md:grid-cols-[1fr_340px] md:gap-7 md:px-7 md:py-[26px]'>
            {/* Content */}
            <div className='flex min-w-0 flex-col gap-4 max-md:order-2'>
                <div className='flex flex-col gap-3 md:gap-6'>
                    {/* Label */}
                    <div className='flex items-center gap-2'>
                        <Image
                            src={LABEL_ICON[pick.label]}
                            alt=''
                            width={24}
                            height={24}
                            className='size-6 shrink-0'
                        />
                        <span className='text-[11px] font-medium uppercase tracking-[0.12em] text-it-primary-hover'>
                            {pick.labelText}
                        </span>
                    </div>

                    <div className='flex flex-col gap-3 md:gap-5'>
                        {/* Title + rating */}
                        <div className='flex flex-col gap-0.5'>
                            <h3 className='m-0 font-it-display text-[20px] leading-[1.2] tracking-[-0.012em] text-it-ink'>
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
                                            <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                                {pick.rating}
                                                {pick.reviewCount !==
                                                    undefined &&
                                                    ` (${pick.reviewCount.toLocaleString()})`}
                                            </span>
                                        </span>
                                        <span className='size-1 shrink-0 rounded-full bg-it-heading/30' />
                                    </>
                                )}
                                <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                    {pick.type}
                                </span>
                            </div>
                        </div>

                        {/* Description + price */}
                        <div className='flex flex-col gap-3'>
                            <p
                                className={`m-0 max-w-[560px] text-[14px] leading-[1.65] text-it-text-muted ${
                                    expanded
                                        ? ''
                                        : 'line-clamp-3 md:line-clamp-none'
                                }`}>
                                {pick.description}
                            </p>
                            <button
                                type='button'
                                onClick={() => setExpanded(v => !v)}
                                className='-mt-1 self-start cursor-pointer border-none bg-transparent p-0 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-4 transition-colors hover:text-it-primary md:hidden'>
                                {expanded ? dict.readLess : dict.learnMore}
                            </button>

                            <p className='m-0 flex items-center gap-4'>
                                <span className='text-[12.5px] leading-[1.6] text-it-text-muted tabular-nums'>
                                    {pick.duration}
                                </span>
                                <span className='size-[3px] shrink-0 rounded-full bg-it-ink-muted' />
                                <span className='text-[12.5px] leading-[1.6] text-it-text-muted tabular-nums'>
                                    {dict.from}{' '}
                                    <b className='text-[15px] font-medium tracking-[-0.012em] text-it-ink'>
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
                    className='inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-it-full border-[1.5px] border-it-primary bg-transparent px-5 py-2.5 text-[13.5px] font-medium leading-[1.6] text-it-primary-hover no-underline transition-colors duration-(--it-duration-xs) hover:bg-it-primary-subtle md:w-auto md:self-start'>
                    {dict.bookTrip}
                </MotionLink>
            </div>

            {/* Image carousel - quiet dots always, arrows on hover/focus (S4j) */}
            <div className='relative aspect-16/10 w-full shrink-0 overflow-hidden rounded-it-md bg-it-bg max-md:order-1'>
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

