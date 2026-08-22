import Image from 'next/image';

import { Reveal } from '../reveal';
import { HubDiscoverCard, type HubDiscoverItem } from './hub-discover-card';
import { HubScrollButton } from './hub-scroll-button';

/**
 * Activity Hub "Discover {hub}" editorial section (Figma node 48371:20778 desktop
 * / 48618:8207 + 48618:8212 mobile). A full-bleed image banner with the heading +
 * summary overlaid at the bottom-left, a grid of editorial cards (two columns
 * desktop, single column mobile), and a closing CTA band (mck-16 §5): one line,
 * one fact, one button on a cta-tint band - the old lone outline pill floated
 * unheld on white and read as less than a button.
 *
 * Rendered as the "Discover" panel inside <HubTripsSection> (a scroll-nav target,
 * like Trips and Private charters), so it sits inside the page's `it-container`.
 * The banner breaks out of that container's horizontal gutter to stay edge-to-
 * edge (capped at the 1440 container max), then re-pads its heading to the same
 * gutter so it lines up with the rest of the page content.
 *
 * Pure + data-driven: owns no state (the per-card "Learn More" toggle lives in
 * the <HubDiscoverCard> leaf). Card content is supplied via `items` (placeholder
 * editorial copy until the hub content API is wired, mirroring the MOCK
 * convention on the rest of the hub page); UI strings come from the dictionary.
 */

export type { HubDiscoverItem } from './hub-discover-card';

export type HubDiscoverDict = {
    /** Banner heading, e.g. "Discover Klein Curaçao". */
    title: string;
    /** Banner sub-line beneath the heading. */
    subtitle: string;
    /** Closing CTA band: one line, one fact, one button (mck-16 §5). */
    cta: {
        /** The one claim, e.g. "You can only get there by boat." */
        title: string;
        /**
         * The fact line, count already bound to the live trips-grid count by the
         * parent (e.g. "9 of them leave from Curaçao, most days."). Null drops
         * the line (a hub with no per-person trips has no honest number).
         */
        fact: string | null;
        /** Button label, e.g. "Pick your boat" - it jumps to the trips grid. */
        button: string;
    };
    /** Mobile "Learn More" toggle (expand). */
    learnMore: string;
    /** Mobile "Read Less" toggle (collapse). */
    readLess: string;
};

// Breaks the banner out to the FULL VIEWPORT width (like the hero), regardless of
// the `it-container` it is nested inside. The 50%/50vw centering trick works
// because every ancestor container is centered in the viewport; an `it-container`
// inside the banner then re-aligns the heading to the page content edge.
// (frontend-root carries `overflow-x: clip` so the 100vw width can't introduce a
// horizontal scrollbar.)
const FULL_BLEED = 'w-screen ml-[calc(50%-50vw)]';

export function HubDiscoverSection({
    items,
    bannerImage,
    bookTripTargetId = 'hub-section-trips',
    dict,
}: {
    items: HubDiscoverItem[];
    /** Full-bleed banner photo - falls back to a neutral placeholder. */
    bannerImage?: string | null;
    /** On-page element id the closing CTA band's button smooth-scrolls to. */
    bookTripTargetId?: string;
    dict: HubDiscoverDict;
}) {
    return (
        <div className='flex flex-col gap-6'>
            {/* ── Section head: a HERO BAND, not a plain heading (founder,
                2026-08-18, Figma 48371:20779) ────────────────────────────────
                Design v2 had flattened this to a white section head and the
                comment here said "the old full-bleed banner band is gone" - it
                is back, and `FULL_BLEED`/`bannerImage` below were the leftovers
                of the original.

                Figma measures it on a 1440 frame: band edge to edge, copy
                inset 120px from the left, 675px of air to its right, 339px
                above it and 90px below. The 120 is not a magic number - it is
                `--it-container-px`, so the copy is simply `it-container` and
                lands on the page's own gutter at every width. What the mockup
                fixes is the BOTTOM gap; the top is whatever the band's height
                leaves over, which is why this is bottom-anchored rather than
                padded from the top.

                Height matches `HubHero` (456/533). The two bands stack on one
                page, and a discover band even slightly off the hero's height
                reads as a mistake rather than as a second band.

                The band is a PLAIN div and `Reveal` wraps the copy inside it.
                Reveal writes an inline `width: 100%` (its `width` prop defaults
                to '100%', not 'auto'), and an inline style beats any class - so
                with the band ON the Reveal, `w-screen` lost silently and the
                breakout rendered at the container's 1200px instead of the full
                viewport. Measured, not guessed: computed width 1200px against a
                2309px document. Animating the copy rather than the whole band
                is the better behaviour anyway. */}
            <div
                className={`${FULL_BLEED} relative flex min-h-[456px] items-end overflow-hidden md:min-h-[533px] ${
                    bannerImage ? 'bg-it-dark' : 'bg-it-bg'
                }`}>
                {bannerImage && (
                    <>
                        <Image
                            src={bannerImage}
                            alt=''
                            fill
                            className='object-cover'
                        />
                        <div className='absolute inset-0 bg-[image:var(--it-scrim-hub)]' />
                    </>
                )}

                {/* Ink on the bare band, white over a photo - the same switch
                    `HubHero` makes. Without it the imageless band (which is
                    what ships today, since nothing passes `bannerImage` yet)
                    would render white copy on a light surface and disappear. */}
                <Reveal className='it-container relative z-10 pb-10 md:pb-[90px]'>
                    <div className='flex max-w-[645px] flex-col gap-1'>
                        <h2
                            className={`m-0 text-[20px] md:text-[26px] leading-[1.2] tracking-[-0.012em] font-medium ${
                                bannerImage ? 'text-it-white' : 'text-it-heading'
                            }`}>
                            {dict.title}
                        </h2>
                        <p
                            className={`m-0 it-text ${
                                bannerImage
                                    ? 'text-it-white/92'
                                    : 'text-it-text-muted'
                            }`}>
                            {dict.subtitle}
                        </p>
                    </div>
                </Reveal>
            </div>

            {/* Editorial grid + CTA.
                Mobile: 16px gap between cards, 24px gap to CTA.
                Desktop: 24px gap between cards, 56px gap to CTA. */}
            <div className='flex flex-col gap-7'>
                <Reveal className='grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-5 md:gap-y-[22px]'>
                    {items.map((item, i) => (
                        <Reveal key={i} delay={0.02} listItem>
                            <HubDiscoverCard
                                item={item}
                                dict={{
                                    learnMore: dict.learnMore,
                                    readLess: dict.readLess,
                                }}
                            />
                        </Reveal>
                    ))}
                </Reveal>

                {/* Closing CTA band (mck-16 §5): the claim + the fact left, the
                    button right (stacked, full-width button on mobile). The band
                    carries the visual weight so the button stays honest in size;
                    its fill is cta-deep, not cta - white text on cta is 3.41:1
                    where 4.5:1 is needed (4.58:1 on cta-deep). */}
                <Reveal>
                    <div className='flex flex-col gap-5 rounded-it-lg bg-it-primary-subtle p-6 md:flex-row md:items-center md:justify-between md:gap-8 md:px-8 md:py-7'>
                        <div className='flex max-w-[560px] flex-col gap-1'>
                            <h3 className='m-0 font-it-display text-[18px] leading-[1.3] tracking-[-0.012em] text-it-heading md:text-[18px] font-medium'>
                                {dict.cta.title}
                            </h3>
                            {dict.cta.fact && (
                                <p className='m-0 text-[13px] leading-[1.6] text-it-ink-secondary tracking-[-0.012em]'>
                                    {dict.cta.fact}
                                </p>
                            )}
                        </div>
                        <HubScrollButton
                            targetId={bookTripTargetId}
                            className='inline-flex h-[46px] w-full shrink-0 cursor-pointer items-center justify-center rounded-it-full bg-it-primary-hover px-8 text-[13px] font-medium leading-none text-it-white no-underline transition-colors hover:bg-(--it-primary-active) md:h-12 md:w-auto md:text-[13px] tracking-[-0.012em]'>
                            {dict.cta.button}
                        </HubScrollButton>
                    </div>
                </Reveal>
            </div>
        </div>
    );
}

