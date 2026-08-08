import Image from 'next/image';
import Link from 'next/link';

import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
import type { Locale } from '@/lib/constants/locales';

import type { SearchZeroState } from '@/components/frontend/navbar/search-typeahead';

import { DestinationHeroSearch } from './destination-hero-search';
import type {
    ActivityLink,
    DestinationHeroDict,
} from './lib/destination-hero.types';

/**
 * Destination hero - `/[locale]/[destination]`. Shell that renders the real
 * island title, the split search (free-text typeahead + date), and the island's
 * activities (categories) as quick links. Kept client-side for the entrance
 * animation; all search behaviour lives in `DestinationHeroSearch`.
 */
export function DestinationHero({
    destinationName,
    dict,
    search,
    locale,
    destinationSlug,
    activities,
    searchZeroState,
    image,
    imageAlt,
}: {
    destinationName: string;
    dict: DestinationHeroDict;
    search: SearchDict;
    locale: Locale;
    destinationSlug: string;
    /** The island's categories, rendered as the "Popular" quick links. */
    activities: ActivityLink[];
    /** Starting points the search panel offers before anything is typed (5.10). */
    searchZeroState?: SearchZeroState;
    /** Optional background photo - falls back to the shared home-hero gradient. */
    image?: string;
    /**
     * Localized alt text from the media library. Resolved by the caller (the
     * loader is server-only) and falls back to the island name.
     */
    imageAlt?: string | null;
}) {
    return (
        // Same shell as the home hero: bottom-anchored on mobile, centred on desktop.
        // z-20 keeps the search typeahead (which overflows the hero) above the next
        // section; the background image is clipped in its own wrapper so the section
        // itself doesn't clip the dropdown.
        <section className='relative z-20 h-[clamp(440px,66vh,560px)] md:h-[clamp(480px,62vh,640px)] flex items-end justify-center bg-it-hero-bg pb-11 md:items-center md:pb-0'>
            {image && (
                <div className='absolute inset-0 overflow-hidden'>
                    <Image
                        src={image}
                        alt={imageAlt || destinationName}
                        fill
                        priority
                        sizes='100vw'
                        className='object-cover object-[50%_58%]'
                    />
                    {/* Design v2 hero scrim (shared token with the homepage). */}
                    <div className='absolute inset-0 bg-[image:var(--it-scrim-hero)]' />
                </div>
            )}

            <div className='it-container w-full flex justify-center'>
                {/* No self-animation: this hero renders in the STATIC shell, so
                    the sitewide PageTransition animates it on navigation - a
                    hydration-started MountReveal on SSR content flashes hidden
                    then re-reveals (the "shake"). */}
                <div className='relative z-10 flex w-full max-w-[680px] flex-col items-center gap-7'>
                    {/* Heading group - title + subtitle */}
                    <div className='flex flex-col items-center gap-3 text-center'>
                        <h1 className='m-0 font-it-display font-bold text-[clamp(31px,3.8vw,48px)] leading-[1.04] tracking-[-0.02em] text-balance text-it-white [text-shadow:0_2px_22px_rgba(0,0,0,0.32)]'>
                            {destinationName} {dict.toursActivities}
                        </h1>
                        <p className='m-0 max-w-[34em] text-[clamp(15px,1.5vw,17.5px)] font-semibold leading-[1.6] text-it-white/95 [text-shadow:0_1px_14px_rgba(0,0,0,0.34)]'>
                            {dict.subtitle}
                        </p>
                    </div>

                    {/* Search group - split search box + activities */}
                    <div className='flex w-full flex-col items-center gap-4'>
                        <DestinationHeroSearch
                            locale={locale}
                            destinationSlug={destinationSlug}
                            // The round button's accessible name is the search
                            // dictionary's own word, not a second copy of it.
                            dict={{ ...dict, searchLabel: search.title }}
                            search={search}
                            zeroState={searchZeroState}
                        />

                        {/* Activities (top categories/hubs) - quick links.
                            ONE LINE THAT SCROLLS ON MOBILE, not a wrapping
                            paragraph: three island names do not fit 375px, and
                            wrapping pushed a second line of links over the hero
                            photo and down onto the fold. The client's own rule
                            (handoff, `@media (max-width:767px)`) is
                            `flex-wrap:nowrap; white-space:nowrap; overflow-x:auto;
                            justify-content:flex-start` - left-aligned so the
                            first link starts where the eye already is, rather
                            than centred with both ends cut off.

                            Desktop keeps the centred wrapping row, where three
                            links fit on one line anyway. */}
                        {activities.length > 0 && (
                            <div className='flex w-full items-center gap-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-[13.5px] font-semibold leading-[1.6] text-it-white/90 max-md:flex-nowrap max-md:justify-start max-md:overflow-x-auto max-md:whitespace-nowrap md:flex-wrap md:justify-center [text-shadow:0_1px_10px_rgba(0,0,0,0.3)]'>
                                <span className='shrink-0'>
                                    {dict.popularLabel}:
                                </span>
                                {activities.map((item, i) => (
                                    <span
                                        key={item.href}
                                        className='flex shrink-0 items-center gap-1.5'>
                                        {i > 0 && (
                                            <span
                                                aria-hidden='true'
                                                className='opacity-60'>
                                                ·
                                            </span>
                                        )}
                                        <Link
                                            href={item.href}
                                            className='text-it-white underline decoration-white/50 underline-offset-[3px] transition-colors duration-300 hover:text-it-primary-subtle'>
                                            {item.label}
                                        </Link>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}

