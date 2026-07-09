import Image from 'next/image';
import { CollectionShareButton } from './collection-share-button';
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
 * Collection hero (Figma node 47433:2069). A full-bleed image band, 533px tall on
 * desktop, with the content bottom-anchored to the container's left gutter: an
 * uppercase eyebrow, the H1 title, a subtitle, and a "{N} tours · From ${price}"
 * meta row. A Share pill sits top-right, aligned to the same container gutter.
 * Falls back to a flat grey placeholder (matching the Figma frame) when no image
 * is set.
 *
 * Pure Server Component - the only interactive element (Share) is isolated in the
 * <CollectionShareButton> client leaf, and <MountReveal> drives the above-fold
 * entrance animation.
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
    return (
        <section
            aria-label={title}
            className='relative flex min-h-105 w-full items-end overflow-hidden bg-it-ink-placeholder md:min-h-120 xl:min-h-133.25'>
            {heroImage && (
                <Image
                    src={heroImage}
                    alt={title}
                    fill
                    priority
                    sizes='100vw'
                    className='object-cover'
                />
            )}

            {/* ── Share pill: pinned top-right, aligned to the container gutter ── */}
            <div className='it-container pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-end xl:top-6'>
                <div className='pointer-events-auto'>
                    <CollectionShareButton label={dict.share} />
                </div>
            </div>

            {/* ── Text block: bottom-left, inside the container gutter ── */}
            <div className='it-container relative z-10 w-full pb-8 md:pb-12 xl:pb-24.5'>
                <div className='flex max-w-177.25 flex-col gap-5 md:gap-6'>
                    {/* Eyebrow + H1 + subtitle - gap 4px */}
                    <MountReveal delay={0.1} yOffset={28}>
                        <div className='flex flex-col gap-1'>
                            {eyebrow && (
                                <p className='m-0 font-normal uppercase text-[14px] xl:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                    {eyebrow}
                                </p>
                            )}
                            <h1 className='m-0 font-medium text-[28px] md:text-[36px] xl:text-[48px] md:w-180 leading-[1.2] tracking-[-0.012em] text-it-white'>
                                {title}
                            </h1>
                            {subtitle && (
                                <p className='m-0 font-normal text-[14px] md:text-[16px] xl:text-[18px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </MountReveal>

                    {/* Meta row: "{N} tours · From ${price}" - gap 16px */}
                    {tourCount > 0 && (
                        <MountReveal delay={0.2} yOffset={20}>
                            <div className='flex items-center gap-4'>
                                <span className='font-normal text-[14px] md:text-[16px] xl:text-[18px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                    {tourCount} {dict.tours}
                                </span>

                                {startingPrice != null && (
                                    <>
                                        <span
                                            aria-hidden='true'
                                            className='size-1.25 shrink-0 rounded-it-full bg-it-white'
                                        />
                                        <span className='flex items-baseline gap-1'>
                                            <span className='font-normal text-[12px] md:text-[13px] xl:text-[14px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                                {dict.from}
                                            </span>
                                            <span className='font-medium text-[14px] md:text-[16px] xl:text-[18px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                                ${startingPrice}
                                            </span>
                                        </span>
                                    </>
                                )}
                            </div>
                        </MountReveal>
                    )}
                </div>
            </div>
        </section>
    );
}
