import Image from 'next/image';
import { HubDiscoverCard, type HubDiscoverItem } from './hub-discover-card';
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

// Cancels / re-applies the `it-container` horizontal gutter (16 / 32 / 120px at
// base / md / xl) so the banner spans the full container width while its heading
// stays aligned to the page content edge.
const BLEED =
    '-mx-[var(--it-container-px-sm)] md:-mx-[var(--it-container-px-md)] xl:-mx-[var(--it-container-px)]';
const GUTTER =
    'px-[var(--it-container-px-sm)] md:px-[var(--it-container-px-md)] xl:px-[var(--it-container-px)]';

export function HubDiscoverSection({
    items,
    bannerImage,
    dict,
}: {
    items: HubDiscoverItem[];
    /** Full-bleed banner photo - falls back to a neutral placeholder. */
    bannerImage?: string | null;
    dict: HubDiscoverDict;
}) {
    return (
        <div className='flex flex-col gap-10 md:gap-[90px]'>
            {/* Full-bleed banner - heading + summary bottom-left.
                Mobile: 332px min-height, 12px rounded corners, 32px bottom padding.
                Desktop: 533px min-height, 20px rounded corners, 90px bottom padding.
                Content re-padded to align with the page content edge. */}
            <Reveal>
                <div
                    className={`relative flex min-h-[332px] items-end overflow-hidden rounded-[12px] bg-it-border md:min-h-[533px] md:rounded-[20px] ${BLEED}`}>
                    {bannerImage ? (
                        <Image
                            src={bannerImage}
                            alt={dict.title}
                            fill
                            className='object-cover'
                            sizes='(max-width: 768px) 100vw, 1200px'
                        />
                    ) : (
                        <div className='absolute inset-0 bg-it-border' />
                    )}
                    <div
                        className={`relative z-10 w-full pb-8 md:pb-[90px] ${GUTTER}`}>
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
                Mobile: 24px gap between cards, 24px gap to CTA.
                Desktop: 24px gap between cards, 56px gap to CTA. */}
            <div className='flex flex-col gap-6 md:gap-14'>
                <Reveal className='grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-6'>
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

                {/* "Book your trip" - outlined orange pill, centered */}
                <Reveal width='fit-content' className='mx-auto'>
                    <button
                        type='button'
                        className='inline-flex h-12 cursor-pointer items-center justify-center rounded-it-full border border-it-primary bg-transparent px-10 font-medium text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors hover:bg-it-primary/5'>
                        {dict.bookTrip}
                    </button>
                </Reveal>
            </div>
        </div>
    );
}

