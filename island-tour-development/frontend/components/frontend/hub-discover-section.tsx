import Image from 'next/image';
import { HubDiscoverCard, type HubDiscoverItem } from './hub-discover-card';
import { HubScrollButton } from './hub-scroll-button';
import { Reveal } from './reveal';

/**
 * Activity Hub "Discover {hub}" editorial section (Figma node 48371:20778 desktop
 * / 48618:8207 + 48618:8212 mobile). A full-bleed image banner with the heading +
 * summary overlaid at the bottom-left, a grid of editorial cards (two columns
 * desktop, single column mobile), and a single "Book your trip" outline CTA.
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
    /** Outline CTA label, e.g. "Book your trip". */
    bookTrip: string;
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
    /** On-page element id the "Book your trip" CTA smooth-scrolls to. */
    bookTripTargetId?: string;
    dict: HubDiscoverDict;
}) {
    return (
        <div className='flex flex-col gap-10 md:gap-[90px]'>
            {/* Full-viewport banner - heading + summary bottom-left. Square
                corners, edge-to-edge like the hero (Figma 1440x533 / 402x332).
                Mobile: 332px min-height, 49px bottom padding.
                Desktop: 533px min-height, 90px bottom padding.
                The inner it-container re-aligns the heading to the page content. */}
            <Reveal>
                <div
                    className={`relative flex min-h-[332px] items-end overflow-hidden bg-it-border md:min-h-[533px] ${FULL_BLEED}`}>
                    {bannerImage ? (
                        <Image
                            src={bannerImage}
                            alt={dict.title}
                            fill
                            className='object-cover'
                            sizes='100vw'
                        />
                    ) : (
                        <div className='absolute inset-0 bg-it-border' />
                    )}
                    <div className='it-container relative z-10 w-full pb-[49px] md:pb-[90px]'>
                        <div className='flex max-w-[645px] flex-col gap-1'>
                            <h2 className='m-0 font-medium text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                                {dict.title}
                            </h2>
                            <p className='m-0 text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                {dict.subtitle}
                            </p>
                        </div>
                    </div>
                </div>
            </Reveal>

            {/* Editorial grid + CTA.
                Mobile: 16px gap between cards, 24px gap to CTA.
                Desktop: 24px gap between cards, 56px gap to CTA. */}
            <div className='flex flex-col gap-6 md:gap-14'>
                <Reveal className='grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6'>
                    {items.map((item, i) => (
                        <HubDiscoverCard
                            key={i}
                            item={item}
                            dict={{
                                learnMore: dict.learnMore,
                                readLess: dict.readLess,
                            }}
                        />
                    ))}
                </Reveal>

                {/* "Book your trip" - outlined orange pill. Full-width on mobile
                    (h-46, 40px sides), hugged + centered on desktop (h-48). */}
                <Reveal className='flex md:justify-center'>
                    <HubScrollButton
                        targetId={bookTripTargetId}
                        className='inline-flex h-[46px] w-full cursor-pointer items-center justify-center rounded-it-full border border-it-primary bg-transparent px-10 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-primary no-underline transition-colors hover:bg-it-primary/5 md:h-12 md:w-auto md:text-[16px]'>
                        {dict.bookTrip}
                    </HubScrollButton>
                </Reveal>
            </div>
        </div>
    );
}

