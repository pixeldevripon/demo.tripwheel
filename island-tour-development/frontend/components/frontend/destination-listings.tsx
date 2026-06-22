/**
 * DestinationListings - "Locals' favorites" section on the Destination page.
 *
 * Wraps the shared <TourCard> grid with a section heading and a "Browse all"
 * footer CTA that matches Figma node 47361:19645.
 *
 * Reuse pattern:
 *   import { DestinationListings } from '@/components/frontend/destination-listings';
 */

import Image from 'next/image';
import Link from 'next/link';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { Reveal } from './reveal';
import type { TourCardDict, TourListing } from './tour-card';
import { TourCard } from './tour-card';

// Re-export so page files only need one import location.
export type { TourCardDict, TourListing };

/**
 * Below this many tours, the "See all" CTA hides the count - a low number
 * (e.g. "See all 12 tours") signals scarcity and works against the CTA.
 */
const COUNT_CTA_THRESHOLD = 20;

export type DestinationListingsDict = TourCardDict & {
    /** Section heading - e.g. "Locals' favorites" */
    title: string;
    /**
     * CTA when the tour count is high enough to be compelling (≥ 20).
     * Placeholders: `{count}` and `{destination}`.
     * e.g. "See all {count} tours in {destination}"
     */
    seeAllCount: string;
    /**
     * CTA fallback when the count is low/unknown - no number.
     * Placeholder: `{destination}`. e.g. "See all {destination} tours"
     */
    seeAll: string;
};

interface DestinationListingsProps {
    dict: DestinationListingsDict;
    tours: TourListing[];
    destinationName: string;
    locale: Locale;
    /** Destination slug - used to build the "All Tours" page href. */
    destinationSlug: string;
    /** Total published tours in this destination - drives the conditional count CTA. */
    totalCount: number;
}

export function DestinationListings({
    dict,
    tours,
    destinationName,
    locale,
    destinationSlug,
    totalCount,
}: DestinationListingsProps) {
    // Derive the subset of dict that TourCard needs.
    const { title, seeAll, seeAllCount, ...cardDict } = dict;

    // Show the dynamic count only when it's compelling; otherwise drop the number.
    const browseLabel =
        totalCount >= COUNT_CTA_THRESHOLD
            ? seeAllCount
                  .replace('{count}', String(totalCount))
                  .replace('{destination}', destinationName)
            : seeAll.replace('{destination}', destinationName);
    const browseHref = localizeHref(locale, `/${destinationSlug}/tours`);

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-12'>
                    {/* ── Section heading ───────────────────────────────────── */}
                    <h2 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {title}
                    </h2>

                    {/* ── Tours ────────────────────────────────────────────────
                        Mobile: horizontal swipe carousel of compact 172px cards
                        (bleeds to the screen edges via -mx-4/px-4). The cards adapt
                        their own typography via container queries (see TourCard).
                        sm+: standard 2 × 3 grid. */}
                    <div className='flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:grid lg:snap-none lg:grid-cols-3 lg:gap-x-6 lg:gap-y-10 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden'>
                        {tours.map(tour => (
                            // Cards in view: ~1.2 (<480) → 1.5 (480+) → ~2.3 (640+ tablet);
                            // full 3-col grid from lg. Widths are viewport fractions so a
                            // sliver of the next card always peeks.
                            <div
                                key={tour.id}
                                className='w-[82vw] min-[480px]:w-[64vw] sm:w-[42vw] shrink-0 snap-start lg:w-auto'>
                                <TourCard tour={tour} dict={cardDict} />
                            </div>
                        ))}
                    </div>

                    {/* ── "Browse all" footer CTA ───────────────────────────── */}
                    <div className='relative flex items-center justify-center  mt-10 py-1'>
                        {/* Horizontal divider */}
                        <div
                            className='absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-it-border'
                            aria-hidden='true'
                        />

                        {/* CTA floats above the line on a white pill */}
                        <Link
                            href={browseHref}
                            className='group relative z-10 inline-flex items-center gap-1 bg-it-white px-5 py-2.5 font-medium text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors duration-150 hover:text-it-primary-hover'>
                            {browseLabel}
                            <Image
                                src='/icons/cta-arrow-right.svg'
                                alt=''
                                width={20}
                                height={20}
                                className='size-5 shrink-0 transition-transform duration-150 group-hover:translate-x-0.5'
                            />
                        </Link>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

