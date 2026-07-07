'use client';

import Image from 'next/image';
import { MountReveal } from './mount-reveal';

export type CollectionHeroDict = {
    tours: string;
    from: string;
    share: string;
};

interface CollectionHeroProps {
    title: string;
    eyebrow: string | null;
    subtitle: string | null;
    heroImage: string | null;
    tourCount: number;
    startingPrice?: number | null;
    dict: CollectionHeroDict;
}

/**
 * Collection page hero — Figma node 47433-2069.
 *
 * Desktop (xl+): exact Figma values — 1440×533px frame, text block
 *   absolutely positioned at left=120px / bottom=98px / max-w=709px.
 * Mobile / tablet: flex column with items-end so text anchors to the
 *   bottom; height and font-sizes scale gracefully.
 *
 * Figma desktop measurements (unchanged):
 *   Root frame    : 1440×533 px
 *   Text block    : left=120px · bottom=98px · max-width=709px
 *   Header gap    : 4px  (eyebrow → heading → subtitle)
 *   Outer gap     : 24px (header group → meta row)
 *   Meta row gap  : 16px · align=center
 *   Dot separator : 5×5px / white / opacity-20
 *   Share btn     : top=24px · right=133px · radius=40px
 *                   padding t12 r16 b12 l16 · gap=8px
 *   Share icon    : 24×24px / #2C2C2C
 *   Share label   : 16px / w-510 / lh-25.6px / ls-(-0.192px) / #2C2C2C
 */
export function CollectionHero({
    title,
    eyebrow,
    subtitle,
    heroImage,
    tourCount,
    startingPrice,
    dict,
}: CollectionHeroProps) {
    const handleShare = () => {
        if (typeof navigator !== 'undefined' && navigator.share) {
            navigator.share({ title, url: window.location.href }).catch(() => null);
        } else if (typeof navigator !== 'undefined') {
            navigator.clipboard.writeText(window.location.href).catch(() => null);
        }
    };

    return (
        /**
         * Layout strategy:
         *   mobile/md  → flex col + items-end: text block flows naturally to
         *                the bottom via padding; height scales with content.
         *   xl+        → switch text block to absolute so Figma positions land
         *                exactly. Use `xl:h-[533px]` for the fixed desktop height.
         */
        <section
            aria-label={title}
            className='relative w-full flex flex-col justify-end
                       h-[420px] md:h-[480px] xl:h-[533px]
                       overflow-hidden bg-[#A6A6A6]'>

            {/* ── Background image ────────────────────────────────────────── */}
            {heroImage ? (
                <div className='absolute inset-0'>
                    <Image
                        src={heroImage}
                        alt={title}
                        fill
                        priority
                        className='object-cover'
                        sizes='100vw'
                    />
                    <div
                        className='absolute inset-0 bg-linear-to-t from-black/72 via-black/30 to-black/12'
                        aria-hidden='true'
                    />
                </div>
            ) : (
                <div
                    className='absolute inset-0 bg-linear-to-br from-[#1a3c5e] to-[#2d6a4f]'
                    aria-hidden='true'
                />
            )}

            {/* ── Share button ─────────────────────────────────────────────── */}
            {/* mobile: top-4 right-4  |  desktop: top-[24px] right-[133px]   */}
            <div className='absolute z-10 top-4 right-4 xl:top-[24px] xl:right-[133px]'>
                <button
                    onClick={handleShare}
                    type='button'
                    aria-label={dict.share}
                    className='flex items-center gap-[8px] bg-white
                               py-[12px] px-[16px]
                               rounded-[40px]
                               transition-opacity hover:opacity-90 active:opacity-75'>
                    {/* Icon: 20×20 on mobile → 24×24 on desktop */}
                    <span
                        className='flex items-center justify-center size-5 xl:size-[24px] shrink-0'
                        aria-hidden='true'>
                        <Image
                            src='/icons/share-outline.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-full'
                        />
                    </span>
                    {/* Hide label on small screens to keep btn compact */}
                    <span className='hidden sm:inline text-[16px] font-[510] leading-[25.6px] tracking-[-0.192px] text-[#2C2C2C]'>
                        {dict.share}
                    </span>
                </button>
            </div>

            {/* ── Text block ───────────────────────────────────────────────── */}
            {/*
             * mobile/md : relative, sits at the bottom via parent flex.
             *             Horizontal padding mirrors the site container px.
             *             Vertical pb gives breathing room above the section edge.
             * xl+       : absolute with exact Figma coords.
             */}
            <div
                className='relative z-10 w-full
                           px-5 pb-10
                           md:px-8 md:pb-12
                           xl:absolute xl:left-[120px] xl:bottom-[98px]
                           xl:max-w-[709px] xl:w-[calc(100%-240px)]
                           xl:px-0 xl:pb-0'>

                <MountReveal delay={0.15} yOffset={30}>
                    {/* Outer column — gap 24px between header block and meta row */}
                    <div className='flex flex-col gap-[24px]'>

                        {/* ── Header group: eyebrow + heading + subtitle — gap 4px ── */}
                        <MountReveal delay={0.2} yOffset={30}>
                            <div className='flex flex-col gap-[4px]'>

                                {eyebrow && (
                                    /* 14px mobile → 16px desktop / w-400 / white */
                                    <p className='m-0 text-[14px] xl:text-[16px]
                                                  font-normal
                                                  leading-[22px] xl:leading-[25.6px]
                                                  tracking-[-0.192px]
                                                  text-white text-center'>
                                        {eyebrow}
                                    </p>
                                )}

                                {/* 28px mobile → 36px md → 48px desktop */}
                                <h1 className='m-0
                                               text-[28px] leading-[33.6px]
                                               md:text-[36px] md:leading-[43.2px]
                                               xl:text-[48px] xl:leading-[57.6px]
                                               font-[510]
                                               tracking-[-0.576px]
                                               text-white text-left'>
                                    {title}
                                </h1>

                                {subtitle && (
                                    /* 15px mobile → 16px md → 18px desktop */
                                    <p className='m-0
                                                  text-[15px] leading-[24px]
                                                  md:text-[16px] md:leading-[25.6px]
                                                  xl:text-[18px] xl:leading-[28.8px]
                                                  font-normal
                                                  tracking-[-0.216px]
                                                  text-white text-left'>
                                        {subtitle}
                                    </p>
                                )}
                            </div>
                        </MountReveal>

                        {/* ── Meta row: "{N} tours · From $36" ─────────────────── */}
                        {tourCount > 0 && (
                            <MountReveal delay={0.3} yOffset={20}>
                                <div className='flex items-center gap-[16px]'>

                                    {/* 15px mobile → 18px desktop */}
                                    <span className='text-[15px] xl:text-[18px]
                                                     font-normal
                                                     leading-[24px] xl:leading-[28.8px]
                                                     tracking-[-0.216px]
                                                     text-white'>
                                        {tourCount} {dict.tours}
                                    </span>

                                    {startingPrice != null && (
                                        <>
                                            {/* Dot — 5×5px / white / opacity-20 */}
                                            <span
                                                aria-hidden='true'
                                                className='size-[5px] rounded-full bg-white opacity-20 shrink-0'
                                            />

                                            {/* "From $36" */}
                                            <span className='flex items-baseline gap-[4px]'>
                                                {/* "From": 13px mobile → 14px desktop */}
                                                <span className='text-[13px] xl:text-[14px]
                                                                 font-normal
                                                                 leading-[22.4px]
                                                                 tracking-[-0.168px]
                                                                 text-white'>
                                                    {dict.from}
                                                </span>
                                                {/* "$36": 15px mobile → 18px desktop */}
                                                <span className='text-[15px] xl:text-[18px]
                                                                 font-[510]
                                                                 leading-[28.8px]
                                                                 tracking-[-0.216px]
                                                                 text-white'>
                                                    ${startingPrice}
                                                </span>
                                            </span>
                                        </>
                                    )}
                                </div>
                            </MountReveal>
                        )}
                    </div>
                </MountReveal>
            </div>
        </section>
    );
}
