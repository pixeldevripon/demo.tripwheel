import Image from 'next/image';
import Link from 'next/link';

import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
import type { Locale } from '@/lib/constants/locales';

import type { SearchZeroState } from '@/components/frontend/navbar/search-typeahead';

import { DestinationHeroSearch } from './destination-hero-search';
import { HeroPopularLinks } from './hero-popular-links';
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
        // The MOBILE height/padding (min-h-[520px] + pb-14) mirror the home hero
        // exactly so the search pill lands at the same y on both pages - a vh-based
        // height here put it visibly lower on tall phones.
        // z-20 keeps the search typeahead (which overflows the hero) above the next
        // section; the background image is clipped in its own wrapper so the section
        // itself doesn't clip the dropdown.
        <section className='relative z-20 min-h-[520px] md:min-h-0 md:h-[clamp(480px,62vh,640px)] flex items-end justify-center bg-it-hero-bg pb-14 md:items-center md:pb-0'>
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
                            Its own client leaf: the row measures its own
                            overflow to fade the scrollable edge, and the hero
                            around it stays in the static shell. */}
                        <HeroPopularLinks
                            label={dict.popularLabel}
                            activities={activities}
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}

