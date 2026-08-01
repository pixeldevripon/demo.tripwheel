import Image from 'next/image';
import { CollectionShareButton } from './collection-share-button';
import { MountReveal } from '../mount-reveal';

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
    /**
     * Localized alt text from the media library. Resolved by the caller (the
     * loader is server-only) and falls back to the collection title.
     */
    heroImageAlt?: string | null;
    tourCount: number;
    /** Localized "from" price incl. currency symbol (e.g. "$120"), or null to hide. */
    startingPrice?: string | null;
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
    heroImageAlt,
    tourCount,
    startingPrice,
    dict,
}: CollectionHeroProps) {
    return (
        // Design v2 .colbanner: a thin ~300px editorial band, content centred
        // vertically, over the 76deg banner scrim.
        <section
            aria-label={title}
            className='relative h-[300px] w-full overflow-hidden bg-it-dark'>
            {heroImage && (
                <>
                    <Image
                        src={heroImage}
                        alt={heroImageAlt || title}
                        fill
                        priority
                        sizes='100vw'
                        className='object-cover object-[center_62%]'
                    />
                    <div className='absolute inset-0 bg-[image:var(--it-scrim-banner)]' />
                </>
            )}

            {/* ── Share pill: pinned top-right, aligned to the container gutter ── */}
            <div className='pointer-events-none absolute inset-x-0 top-[18px] z-10 flex justify-end px-6'>
                <div className='pointer-events-auto'>
                    <CollectionShareButton label={dict.share} />
                </div>
            </div>

            {/* ── Text block: bottom-left, inside the container gutter ── */}
            <div className='it-container absolute inset-0 z-10 flex flex-col justify-center'>
                <div className='flex max-w-[640px] flex-col'>
                    {/* Eyebrow + H1 + subtitle - gap 4px */}
                    <MountReveal delay={0.1} yOffset={28}>
                        <div className='flex flex-col'>
                            {eyebrow && (
                                <p className='m-0 text-[11.5px] font-bold uppercase tracking-[0.14em] text-it-white/85'>
                                    {eyebrow}
                                </p>
                            )}
                            <h1 className='m-0 mt-2 font-it-display text-[clamp(26px,3.6vw,38px)] font-bold leading-[1.1] tracking-[-0.015em] text-it-white'>
                                {title}
                            </h1>
                            {subtitle && (
                                <p className='m-0 mt-2.5 text-[15px] font-semibold leading-[1.6] text-it-white/92'>
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </MountReveal>

                    {/* Meta row: "{N} tours · From ${price}" - gap 16px */}
                    {tourCount > 0 && (
                        <MountReveal delay={0.2} yOffset={20}>
                            <div className='mt-2 flex items-center gap-2 text-[13px] font-semibold leading-[1.6] text-it-white/85 tabular-nums'>
                                <span>
                                    {tourCount} {dict.tours}
                                </span>
                                {startingPrice != null && (
                                    <>
                                        <span
                                            aria-hidden='true'
                                            className='text-it-white/55'>
                                            ·
                                        </span>
                                        <span>
                                            {dict.from} {startingPrice}
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
