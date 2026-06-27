'use client';

import Image from 'next/image';
import { useState } from 'react';

export type HubDiscoverItem = {
    /** Card heading, e.g. "The White Beach". */
    title: string;
    /** Card body paragraph. */
    body: string;
    /** Card image - falls back to a neutral placeholder when absent. */
    image?: string | null;
};

export type HubDiscoverCardDict = {
    learnMore: string;
    readLess: string;
};

/**
 * One "Discover {hub}" editorial card (Figma node 48371:20778 desktop /
 * 48618:8212 mobile): image on top, then title + body. Desktop shows the full
 * body; mobile clamps it to four lines with a "Learn More" / "Read Less" toggle
 * (mirrors <HubPickCard>). Image ratio is 370:178 (mobile) / 588:300 (desktop);
 * text is inset 16px (mobile) / 24px (desktop).
 */
export function HubDiscoverCard({
    item,
    dict,
}: {
    item: HubDiscoverItem;
    dict: HubDiscoverCardDict;
}) {
    const [expanded, setExpanded] = useState(false);

    return (
        <article className='flex flex-col overflow-hidden rounded-[12px] border border-it-border bg-it-white md:rounded-[16px]'>
            {/* Image - aspect 370:178 mobile / 588:300 desktop, with rounded top corners */}
            <div className='relative aspect-[370/178] w-full overflow-hidden bg-it-border md:aspect-[588/300]'>
                {item.image ? (
                    <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes='(max-width: 768px) 100vw, 600px'
                        className='object-cover'
                    />
                ) : (
                    <div className='absolute inset-0 bg-it-border' />
                )}
            </div>

            {/* Text content - 16px inset mobile / 24px inset desktop */}
            <div className='flex flex-col gap-2 px-4 py-4 md:gap-3 md:px-6 md:py-5'>
                <h3 className='m-0 font-medium text-[18px] md:text-[20px] leading-[1.4] tracking-[-0.012em] text-it-heading'>
                    {item.title}
                </h3>
                <p
                    className={`m-0 text-[14px] md:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-text-muted ${
                        expanded ? '' : 'line-clamp-3 md:line-clamp-none'
                    }`}>
                    {item.body}
                </p>
                <button
                    type='button'
                    onClick={() => setExpanded((v) => !v)}
                    className='-mt-0.5 self-start cursor-pointer border-none bg-transparent p-0 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors hover:text-it-primary md:hidden'>
                    {expanded ? dict.readLess : dict.learnMore}
                </button>
            </div>
        </article>
    );
}
