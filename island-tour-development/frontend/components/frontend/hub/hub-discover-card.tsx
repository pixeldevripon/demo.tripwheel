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
 * One "Discover {hub}" editorial card (Figma node 48371:20785 desktop /
 * 48618:8212 mobile): a rounded, 1px-bordered surface card with a full-width
 * image on top, then title + body. Desktop shows the full body; mobile clamps it
 * to four lines with a "Learn More" / "Read Less" toggle (mirrors <HubPickCard>).
 *
 * Figma: card radius 8px (mobile) / 16px (desktop); 1px `it-heading` border on an
 * `it-surface` fill; image ratio 370:178 (mobile) / 588:300 (desktop); content
 * inset 16px sides + 16px bottom + 10px top (mobile) / 24px all (desktop); 8px
 * gap between title and body. Cards stretch to their row height, so the shorter
 * card's spare space falls below the body.
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
        <article className='flex h-full flex-col overflow-hidden rounded-[8px] border border-it-border-subtle bg-it-surface md:rounded-[16px]'>
            {/* Image - aspect 370:178 mobile / 588:300 desktop; card clips the top corners */}
            <div className='relative aspect-370/178 w-full bg-it-border md:aspect-588/300'>
                {item.image && (
                    <Image
                        src={item.image}
                        alt={item.title}
                        fill
                        sizes='(max-width: 768px) 100vw, 600px'
                        className='object-cover'
                    />
                )}
            </div>

            {/* Text content - inset 16px sides / 16px bottom / 10px top (mobile),
                24px all (desktop); 8px title->body gap. */}
            <div className='flex flex-col gap-2 px-4 pt-2.5 pb-4 md:px-6 md:pt-6 md:pb-6'>
                <h3 className='m-0 font-medium text-[18px] md:text-[24px] leading-[1.6] tracking-[-0.012em] text-it-heading md:leading-[1.2]'>
                    {item.title}
                </h3>
                <p
                    className={`m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted ${
                        expanded ? '' : 'line-clamp-4 md:line-clamp-none'
                    }`}>
                    {item.body}
                </p>
                <button
                    type='button'
                    onClick={() => setExpanded((v) => !v)}
                    className='-mt-1 self-start cursor-pointer border-none bg-transparent p-0 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-heading transition-colors hover:text-it-primary md:hidden'>
                    {expanded ? dict.readLess : dict.learnMore}
                </button>
            </div>
        </article>
    );
}
