import Image from 'next/image';
import { Reveal } from '../reveal';
import { HubDiscoverCard, type HubDiscoverItem } from './hub-discover-card';
import { HubScrollButton } from './hub-scroll-button';

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
        // Design v2 .hs: plain white section head over the 2-col editorial
        // grid - the old full-bleed banner band is gone.
        <div className='flex flex-col gap-6'>
            <Reveal>
                <div className='flex max-w-[640px] flex-col gap-2'>
                    <h2 className='m-0 font-it-display text-[clamp(22px,2.8vw,30px)] font-bold leading-[1.2] tracking-[-0.015em] text-it-ink'>
                        {dict.title}
                    </h2>
                    <p className='m-0 text-[14.5px] leading-[1.6] text-it-text-muted'>
                        {dict.subtitle}
                    </p>
                </div>
            </Reveal>

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

