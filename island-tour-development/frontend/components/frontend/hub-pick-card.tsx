'use client';

import Image from 'next/image';
import { useState } from 'react';

export type HubPickLabel = 'best' | 'popular' | 'families';

export type HubPick = {
    id: string;
    label: HubPickLabel;
    /** Localized label text, e.g. "BEST OVERALL". */
    labelText: string;
    title: string;
    rating: number;
    reviewCount: number;
    /** Boat type, e.g. "Yacht". */
    type: string;
    description: string;
    /** e.g. "Full day". */
    duration: string;
    price: number;
    image?: string | null;
};

export type HubPickCardDict = {
    from: string;
    bookTrip: string;
    learnMore: string;
    readLess: string;
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
        <article className='flex overflow-hidden rounded-[8px] border border-it-heading/10 bg-it-surface md:rounded-[16px]'>
            {/* Content */}
            <div className='flex flex-1 flex-col justify-between gap-10 p-4 md:gap-6 md:p-8'>
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
                        <span className='text-[16px] leading-[1.6] tracking-[-0.012em] text-[#858585]'>
                            {pick.labelText}
                        </span>
                    </div>

                    <div className='flex flex-col gap-3 md:gap-5'>
                        {/* Title + rating */}
                        <div className='flex flex-col gap-0.5'>
                            <h3 className='m-0 font-medium text-[20px] md:text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                {pick.title}
                            </h3>
                            <div className='flex items-center gap-4'>
                                <span className='flex items-center gap-2'>
                                    <Image
                                        src='/icons/star-listings.svg'
                                        alt=''
                                        width={16}
                                        height={16}
                                        className='size-4 shrink-0'
                                    />
                                    <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                        {pick.rating} ({pick.reviewCount.toLocaleString()})
                                    </span>
                                </span>
                                <span className='size-1 shrink-0 rounded-full bg-it-heading/30' />
                                <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                    {pick.type}
                                </span>
                            </div>
                        </div>

                        {/* Description + price */}
                        <div className='flex flex-col gap-3'>
                            <p
                                className={`m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted ${
                                    expanded ? '' : 'line-clamp-3 md:line-clamp-none'
                                }`}>
                                {pick.description}
                            </p>
                            <button
                                type='button'
                                onClick={() => setExpanded((v) => !v)}
                                className='-mt-1 self-start cursor-pointer border-none bg-transparent p-0 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-4 transition-colors hover:text-it-primary md:hidden'>
                                {expanded ? dict.readLess : dict.learnMore}
                            </button>

                            <p className='m-0 flex items-center gap-4'>
                                <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                    {pick.duration}
                                </span>
                                <span className='size-1 shrink-0 rounded-full bg-it-heading/30' />
                                <span className='text-it-heading'>
                                    <span className='text-[12px] leading-[1.6] tracking-[-0.012em] text-it-heading/70'>
                                        {dict.from}{' '}
                                    </span>
                                    <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                        ${pick.price.toLocaleString()}
                                    </span>
                                </span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Book this Trip - outlined orange */}
                <button
                    type='button'
                    className='inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-it-full border border-it-primary bg-transparent px-10 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors hover:bg-it-primary/5 md:h-12 md:w-auto md:min-w-85 md:text-[16px]'>
                    {dict.bookTrip}
                </button>
            </div>

            {/* Image */}
            <div className='relative w-[42%] shrink-0 self-stretch bg-it-border md:w-[49%]'>
                {pick.image && (
                    <Image
                        src={pick.image}
                        alt={pick.title}
                        fill
                        className='object-cover'
                    />
                )}
            </div>
        </article>
    );
}
