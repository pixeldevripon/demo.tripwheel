/**
 * DestinationListings - "Locals' favorites" section on the Destination page.
 *
 * Wraps the shared <TourCard> grid with a section heading and a "Browse all"
 * footer CTA that matches Figma node 47361:19645.
 *
 * ── Position / ordering logic (master §7.2 + §3.8) ──────────────────────────
 * This component is presentation-only: it renders `tours` in the EXACT order it
 * receives them and never re-sorts. Position is owned by the backend so every
 * listing surface is consistent (full write-up:
 * technical-doc/03-implementation/TOUR-RANKING.md):
 *
 *   1. Ranking (master §7.2): the API returns tours ordered
 *        `tier_rank ASC, quality_score DESC, id ASC`
 *      - the "Locals' favorites" / Recommended order. Paid tiers float up via
 *      tier_rank alone (no separate sponsored sort key); the Sponsored badge is
 *      cosmetic and does not change position.
 *   2. Bookability (§7.2): non-live / not-bookable / no-30-day-availability tours
 *      are filtered out server-side, so they never occupy a slot here.
 *   3. Diversity pass (§3.8): the backend already broke up runs of >2 same-subtype
 *      tours before sending the page - we must not undo it by re-sorting.
 *
 * This grid is the destination featured subset (tours flagged isLocalsFavourite,
 * page.tsx requests `sort=recommended`). The peach-tint-card-#1 rule (§B.63) is an
 * All-Tours-page concern and is intentionally NOT applied here.
 *
 * Reuse pattern:
 *   import { DestinationListings } from '@/components/frontend/destination/destination-listings';
 */

import { localizeHref, type Locale } from '@/lib/constants/locales';
import { TOUR_CARD_GRID } from '@/lib/tours/listing';
import Image from 'next/image';
import Link from 'next/link';
import { Reveal } from '../reveal';
import { SectionHead } from '../section-head';
import type { TourCardDict, TourListing } from '../tour-card';
import { TourCard } from '../tour-card';

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
    /** Kicker line above the heading - "Chosen by people who live here". */
    kicker: string;
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
    const { title, kicker, seeAll, seeAllCount, ...cardDict } = dict;

    // Show the dynamic count only when it's compelling; otherwise drop the number.
    const browseLabel =
        totalCount >= COUNT_CTA_THRESHOLD
            ? seeAllCount
                  .replace('{count}', String(totalCount))
                  .replace('{destination}', destinationName)
            : seeAll.replace('{destination}', destinationName);
    const browseHref = localizeHref(locale, `/${destinationSlug}/tours`);

    return (
        <section className='bg-it-white pt-11 md:pt-14'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-5'>
                    {/* ── Section head: kicker + title (design v2 sechead) ─── */}
                    <SectionHead kicker={kicker} title={title} />

                    {/* ── Tours ────────────────────────────────────────────────
                        Mobile (<640): stacked horizontal row cards (mockup 3.5
                        locked mobile card, image 40 / content 60).
                        sm: 3-col grid · lg: 4-col grid (DIT-13). */}
                    <div className={TOUR_CARD_GRID}>
                        {tours.map((tour, i) => (
                            <Reveal key={tour.id} width='auto' listItem>
                                <TourCard
                                    tour={tour}
                                    dict={cardDict}
                                    highlighted={i === 0}
                                    mobileRow
                                />
                            </Reveal>
                        ))}
                    </div>

                    {/* ── See-all CTA (design v2 .seeall, C21 count rule) ──── */}
                    <div className='mt-2 flex justify-center'>
                        <Link
                            href={browseHref}
                            className='inline-flex items-center justify-center gap-2.5 rounded-it-sm bg-it-primary px-7 py-3.5 text-[16.5px] md:text-[19px] font-medium text-it-white no-underline transition-colors duration-(--it-duration-xs) ease-(--it-ease) hover:bg-it-primary-hover max-sm:w-full'>
                            {browseLabel}
                            <Image
                                src='/icons/hero-arrow-right.svg'
                                alt=''
                                width={20}
                                height={20}
                                className='size-4.5 shrink-0'
                            />
                        </Link>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

