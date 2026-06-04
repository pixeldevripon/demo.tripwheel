/**
 * DestinationListings — "Locals' favorites" section on the Destination page.
 *
 * Wraps the shared <TourCard> grid with a section heading and a "Browse all"
 * footer CTA that matches Figma node 47361:19645.
 *
 * Reuse pattern:
 *   import { DestinationListings } from '@/components/frontend/destination-listings';
 */

import Link from 'next/link';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { Reveal } from './reveal';
import type { TourCardDict, TourListing } from './tour-card';
import { TourCard } from './tour-card';

// Re-export so page files only need one import location.
export type { TourCardDict, TourListing };

export type DestinationListingsDict = TourCardDict & {
    /** Section heading — e.g. "Locals' favorites" */
    title: string;
    /**
     * Footer CTA label with a `{destination}` placeholder.
     * e.g. "Browse all tours in {destination}"
     */
    browseAll: string;
};

interface DestinationListingsProps {
    dict: DestinationListingsDict;
    tours: TourListing[];
    destinationName: string;
    locale: Locale;
    /** Destination slug — used to build the "All Tours" page href. */
    destinationSlug: string;
}

export function DestinationListings({
    dict,
    tours,
    destinationName,
    locale,
    destinationSlug,
}: DestinationListingsProps) {
    // Derive the subset of dict that TourCard needs (all keys except title/browseAll).
    const { title, browseAll, ...cardDict } = dict;

    const browseLabel = browseAll.replace('{destination}', destinationName);
    const browseHref = localizeHref(locale, `/${destinationSlug}/tours`);

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-12'>
                    {/* ── Section heading ───────────────────────────────────── */}
                    <h2 className='m-0 font-medium text-[28px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {title}
                    </h2>

                    {/* ── 2 × 3 tour grid ──────────────────────────────────── */}
                    <div className='grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3'>
                        {tours.map(tour => (
                            <TourCard
                                key={tour.id}
                                tour={tour}
                                dict={cardDict}
                            />
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
                            className='relative z-10 inline-flex items-center gap-2 bg-it-white px-5 py-2.5 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary transition-colors duration-150 hover:text-it-primary-hover hover:border-it-primary'>
                            {browseLabel}
                        </Link>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

