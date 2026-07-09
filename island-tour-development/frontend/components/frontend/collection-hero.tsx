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
            navigator
                .share({ title, url: window.location.href })
                .catch(() => null);
        } else if (typeof navigator !== 'undefined') {
            navigator.clipboard
                .writeText(window.location.href)
                .catch(() => null);
        }
    };

    return (
        <section
            aria-label={title}
            className='relative w-full flex flex-col justify-end
                       h-[420px] md:h-[480px] xl:h-[533px]
                       overflow-hidden
                       bg-[#A6A6A6]'>
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
                    {/* Dark scrim so white text stays legible over any photo */}
                    <div
                        className='absolute inset-0 bg-linear-to-t from-black/72 via-black/30 to-black/12'
                        aria-hidden='true'
                    />
                </div>
            ) : null}

            {/* ── Share button ─────────────────────────────────────────────── */}

            <div className='absolute z-10 top-3 right-3 sm:top-4 sm:right-4 xl:top-[24px] xl:right-[133px]'>
                <button
                    onClick={handleShare}
                    type='button'
                    aria-label={dict.share}
                    className='flex items-center gap-[8px] bg-white
                               py-[10px] px-[12px]
                               sm:py-[12px] sm:px-[16px]
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
                    {/* Label hidden on xs to keep button compact; shown sm+ */}
                    <span className='hidden sm:inline text-[14px] xl:text-[16px] font-medium leading-[25.6px] tracking-[-0.192px] text-[#2C2C2C] underline underline-offset-2'>
                        {dict.share}
                    </span>
                </button>
            </div>

            {/* ── Text block ───────────────────────────────────────────────── */}

            <div
                className='relative z-10 w-full
                           px-4 pb-8
                           sm:px-5 sm:pb-10
                           md:px-8 md:pb-12
                           xl:absolute xl:left-[120px] xl:bottom-[98px]
                           xl:max-w-[709px] xl:w-[calc(100%-240px)]
                           xl:px-0 xl:pb-0'>
                <MountReveal delay={0.15} yOffset={30}>
                    {/* Outer column — gap 24px between header block and meta row */}
                    <div className='flex flex-col gap-[20px] md:gap-[24px]'>
                        {/* ── Header group: eyebrow + heading + subtitle — gap 4px ── */}
                        <MountReveal delay={0.2} yOffset={30}>
                            <div className='flex flex-col gap-[4px] max-w-[709px]'>
                                {eyebrow && (
                                    /* 13px mobile → 14px md → 16px desktop */
                                    <p
                                        className='m-0
                                                  text-[13px] md:text-[14px] xl:text-[16px]
                                                  font-normal
                                                  leading-[20px] md:leading-[22px] xl:leading-[25.6px]
                                                  tracking-[-0.192px]
                                                  text-white uppercase text-left'>
                                        {eyebrow}
                                    </p>
                                )}

                                {/* 26px mobile → 34px md → 48px desktop */}
                                <h1
                                    className='m-0
                                               text-[26px] leading-[31.2px]
                                               md:text-[34px] md:leading-[40.8px]
                                               xl:text-[48px] xl:leading-[57.6px]
                                                font-medium
                                               tracking-[-0.576px] md:w-[809px]
                                               text-white text-left'>
                                    {title}
                                </h1>

                                {subtitle && (
                                    /* 14px mobile → 16px md → 18px desktop */
                                    <p
                                        className='m-0
                                                  text-[14px] leading-[22.4px]
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
                                <div className='flex items-center gap-[12px] md:gap-[16px]'>
                                    {/* "N tours": 14px mobile → 16px md → 18px desktop */}
                                    <span
                                        className='text-[14px] md:text-[16px] xl:text-[18px]
                                                     font-normal
                                                     leading-[22.4px] md:leading-[25.6px] xl:leading-[28.8px]
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
                                                {/* "From": 12px mobile → 13px md → 14px desktop */}
                                                <span
                                                    className='text-[12px] md:text-[13px] xl:text-[14px]
                                                                 font-normal
                                                                 leading-[19.2px] md:leading-[20.8px] xl:leading-[22.4px]
                                                                 tracking-[-0.168px]
                                                                 text-white'>
                                                    {dict.from}
                                                </span>
                                                {/* Price: 14px mobile → 16px md → 18px desktop */}
                                                <span
                                                    className='text-[14px] md:text-[16px] xl:text-[18px]
                                                                 font-[510]
                                                                 leading-[22.4px] md:leading-[25.6px] xl:leading-[28.8px]
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


