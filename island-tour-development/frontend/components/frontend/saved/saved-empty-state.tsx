'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import {
    TourCard,
    type TourCardDict,
    type TourListing,
} from '@/components/frontend/tour-card';
import { localizeHref, type Locale } from '@/lib/constants/locales';

/** Everything the empty state needs about one island, resolved on the server. */
export type SavedEmptyDestination = {
    slug: string;
    name: string;
    /** Category quick links, already gated by the backend. */
    categories: { slug: string; name: string }[];
    /** Three tours with live hearts - the first save happens here. */
    favourites: TourListing[];
    /**
     * Whether `favourites` really is the curated Locals' favorites set, or the
     * island's recommended tours standing in for it. Only the heading changes:
     * calling a fallback "Locals' favorites" would be a claim about curation
     * that nobody made.
     */
    curated: boolean;
};

export type SavedEmptyDict = {
    /** "Nothing saved yet" */
    title: string;
    /** "Tap the heart on any tour and it stays right here. Your plans, in one place." */
    body: string;
    /** Carries {destination}. */
    cta: string;
    /** Used when no island is in play at all. */
    ctaGeneric: string;
    /** "Locals' favorites" - the curated set. */
    favouritesTitle: string;
    /** Heading when the curated set is empty and recommended tours stand in. */
    popularTitle: string;
    /** "Tap a heart to start your list." */
    favouritesHint: string;
};

/** localStorage key the navbar writes the last-viewed island to. */
const DESTINATION_KEY = 'it.activeDestination';

/**
 * The empty saved list (mck-17 [H], master 5.12).
 *
 * What it replaces was one centred line of text in a screen of white, with
 * nothing on it to click. Somebody standing on an empty saved page has already
 * told us they like the idea of saving, which makes it the cheapest moment on
 * the platform to turn them into a saver - and spending it on an instruction
 * about how the feature works is spending it on nothing.
 *
 * So: the way back to the island, the categories, and three real tours with
 * live hearts, so the first save can happen right here. Left aligned with the
 * page, not centred in the void.
 *
 * The island is whichever one the visitor was last looking at (the navbar
 * remembers it in localStorage), falling back to the launch island. That read
 * happens after mount, so the first paint uses the fallback - which is why
 * every destination's copy is resolved on the server rather than fetched here:
 * swapping islands must not cost a request or a flash of empty page.
 */
export function SavedEmptyState({
    locale,
    dict,
    cardDict,
    destinations,
}: {
    locale: Locale;
    dict: SavedEmptyDict;
    cardDict: TourCardDict;
    /** Every active island, launch island first. */
    destinations: SavedEmptyDestination[];
}) {
    const [rememberedSlug, setRememberedSlug] = useState<string | null>(null);
    useEffect(() => {
        setRememberedSlug(window.localStorage.getItem(DESTINATION_KEY));
    }, []);

    const island =
        destinations.find(d => d.slug === rememberedSlug) ?? destinations[0];

    return (
        <div className='flex flex-col'>
            <Image
                src='/icons/heart-outline.svg'
                alt=''
                width={56}
                height={56}
                className='size-14 opacity-40'
                aria-hidden='true'
            />

            <h1 className='m-0 mt-3.5 font-it-display text-[clamp(24px,3vw,32px)] leading-[1.15] tracking-[-0.012em] text-it-heading font-medium'>
                {dict.title}
            </h1>
            <p className='m-0 mt-2 max-w-[520px] text-[15.5px] leading-[1.6] text-it-text-muted'>
                {dict.body}
            </p>

            {island && (
                <Link
                    href={localizeHref(locale, `/${island.slug}/tours`)}
                    className='mt-[18px] w-fit rounded-it-full bg-it-primary px-[22px] py-[13px] text-[14px] font-medium leading-[1.6] text-it-white no-underline transition-colors duration-(--it-duration-xs) ease-(--it-ease) hover:bg-it-primary-hover'>
                    {dict.cta.replace('{destination}', island.name)} &rarr;
                </Link>
            )}
            {!island && (
                <Link
                    href={localizeHref(locale, '/search')}
                    className='mt-[18px] w-fit rounded-it-full bg-it-primary px-[22px] py-[13px] text-[14px] font-medium leading-[1.6] text-it-white no-underline hover:bg-it-primary-hover'>
                    {dict.ctaGeneric} &rarr;
                </Link>
            )}

            {island && island.categories.length > 0 && (
                <div className='mt-[26px] flex flex-wrap gap-[9px]'>
                    {island.categories.map(category => (
                        <Link
                            key={category.slug}
                            href={localizeHref(
                                locale,
                                `/${island.slug}/${category.slug}`
                            )}
                            className='rounded-it-full border border-it-border bg-it-white px-[15px] py-[9px] text-[13px] font-medium leading-[1.6] text-it-heading no-underline transition-colors duration-(--it-duration-xs) ease-(--it-ease) hover:border-it-ink'>
                            {category.name}
                        </Link>
                    ))}
                </div>
            )}

            {island && island.favourites.length > 0 && (
                <section className='mt-10'>
                    <h2 className='m-0 font-it-display text-[22px] leading-[1.2] text-it-heading font-medium'>
                        {island.curated
                            ? dict.favouritesTitle
                            : dict.popularTitle.replace(
                                  '{destination}',
                                  island.name
                              )}
                    </h2>
                    <p className='m-0 mb-4 mt-[5px] text-[13.5px] leading-[1.6] text-it-text-muted'>
                        {dict.favouritesHint}
                    </p>
                    {/* Three across, not the sitewide four (mockup `.g3`):
                        this is a starter set, and three cards read as a
                        suggestion where a full row reads as a listing. */}
                    <div className='grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-5 lg:grid-cols-3'>
                        {island.favourites.map(tour => (
                            <TourCard
                                key={tour.id}
                                tour={tour}
                                dict={cardDict}
                                mobileRow
                            />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}
