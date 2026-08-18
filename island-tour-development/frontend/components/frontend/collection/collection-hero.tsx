import Image from 'next/image';
import { MountReveal } from '../mount-reveal';
import { CollectionShareButton } from './collection-share-button';

export type CollectionHeroDict = {
    tours: string;
    from: string;
    share: string;
    /** Confirmation shown after the URL is copied (no native share sheet). */
    linkCopied: string;
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
 * Collection hero (Figma node 47433:2069). A thin 300px editorial band on
 * desktop, with the content bottom-anchored to the container's left gutter: an
 * uppercase eyebrow, the H1 title, a subtitle, and a "{N} tours · From ${price}"
 * meta row. A Share pill sits top-right, aligned to the same content column
 * as the title (not to the banner edge - Pastel #48).
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
            className={`relative h-[300px] w-full overflow-hidden ${heroImage ? 'bg-it-dark' : 'bg-it-bg'}`}>
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

            {/* ── Share pill: top-right of the CONTENT column ──
                Pastel #48. This row used to be `inset-x-0 ... px-6`, i.e. 24px
                from the BANNER edge, while the title below sits inside
                `it-container` - so on a wide screen the pill drifted hundreds of
                pixels away from the column it belongs to. (The old comment
                claimed it was "aligned to the container gutter"; it was not.)

                It now carries the container's own max-width, so its right edge
                lands exactly where the title's gutter does at every width above
                the cap, and moves with that token rather than a magic number.

                MOBILE IS UNCHANGED, which the issue requires: `px-6` is kept
                rather than switching to `it-container`, whose padding drops to
                16px below 768px. Under the max-width this is byte-identical to
                the previous markup; only wide screens move. */}
            {/* z-20, ABOVE the text block below - not the z-10 they used to
                share. The text block is `absolute inset-0`, so it covers this
                whole band; at an equal z-index the later element in the DOM
                wins, and every click on the pill landed on the title's box
                instead. The button was never broken - nothing could reach it,
                on any viewport.

                The text block keeps `pointer-events: auto` so its heading and
                subtitle stay selectable; the control that floats over it is
                simply the thing on top. */}
            <div className='pointer-events-none absolute inset-x-0 top-[18px] z-20'>
                <div className='mx-auto flex w-full max-w-(--it-container-max) justify-end px-6'>
                    <div className='pointer-events-auto'>
                        <CollectionShareButton
                            label={dict.share}
                            copiedLabel={dict.linkCopied}
                        />
                    </div>
                </div>
            </div>

            {/* ── Text block: bottom-left, inside the container gutter ── */}
            <div className='it-container absolute inset-0 z-10 flex flex-col justify-center'>
                <div className='flex max-w-[640px] flex-col'>
                    {/* Eyebrow + H1 + subtitle - gap 4px */}
                    <MountReveal delay={0.1} yOffset={28}>
                        <div className='flex flex-col'>
                            {eyebrow && (
                                <p
                                    className={`m-0 text-[11.5px] font-bold uppercase tracking-[0.14em] ${heroImage ? 'text-it-white/85 tracking-[-0.012em]' : 'text-it-primary-hover tracking-[-0.012em]'}`}>
                                    {eyebrow}
                                </p>
                            )}
                            <h1
                                className={`m-0 mt-2 font-it-display text-[clamp(26px,3.6vw,38px)] font-bold leading-[1.1] tracking-[-0.015em] ${heroImage ? 'text-it-white font-medium tracking-[-0.012em] leading-[1.6] text-[20px]' : 'text-it-primary-fg font-medium tracking-[-0.012em] text-[32px] md:text-[48px] leading-[1.2]'}`}>
                                {title}
                            </h1>
                            {subtitle && (
                                <p
                                    className={`m-0 mt-2.5 text-[15px] font-medium leading-[1.6] ${heroImage ? 'text-it-white/92 tracking-[-0.012em]' : 'text-it-text-muted tracking-[-0.012em]'}`}>
                                    {subtitle}
                                </p>
                            )}
                        </div>
                    </MountReveal>

                    {/* Meta row: "{N} tours · From ${price}" - gap 16px */}
                    {tourCount > 0 && (
                        <MountReveal delay={0.2} yOffset={20}>
                            <div
                                className={`mt-2 flex items-center gap-2 text-[13px] font-medium leading-[1.6] tabular-nums ${heroImage ? 'text-it-white/85 tracking-[-0.012em]' : 'text-it-text-muted tracking-[-0.012em]'}`}>
                                <span>
                                    {tourCount} {dict.tours}
                                </span>
                                {startingPrice != null && (
                                    <>
                                        <span
                                            aria-hidden='true'
                                            className={
                                                heroImage
                                                    ? 'text-it-white/55 tracking-[-0.012em]'
                                                    : 'text-it-text-muted tracking-[-0.012em]'
                                            }>
                                            ·
                                        </span>
                                        <span>
                                            {/* Locked stats format (5.6):
                                                capital F, space, no "per". */}
                                            {dict.from.charAt(0).toUpperCase() +
                                                dict.from.slice(1)}{' '}
                                            {startingPrice}
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

