import Image from 'next/image';
import Link from 'next/link';

import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
import type { Locale } from '@/lib/constants/locales';

import { DestinationHeroSearch } from './destination-hero-search';
import type { ActivityLink, DestinationHeroDict } from './lib/destination-hero.types';

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
    image,
}: {
    destinationName: string;
    dict: DestinationHeroDict;
    search: SearchDict;
    locale: Locale;
    destinationSlug: string;
    /** The island's categories, rendered as the "Popular" quick links. */
    activities: ActivityLink[];
    /** Optional background photo - falls back to the shared home-hero gradient. */
    image?: string;
}) {
    return (
        // Same shell as the home hero: bottom-anchored on mobile, centred on desktop.
        // z-20 keeps the search typeahead (which overflows the hero) above the next
        // section; the background image is clipped in its own wrapper so the section
        // itself doesn't clip the dropdown.
        <section className='relative z-20 h-136.75 md:h-150 2xl:h-180 flex items-end justify-center bg-it-hero-bg pb-12 md:items-center md:pb-0'>
            {image && (
                <div className='absolute inset-0 overflow-hidden'>
                    <Image src={image} alt={destinationName} fill priority className='object-cover' />
                    {/* Legibility overlay over the photo */}
                    <div className='absolute inset-0 bg-black/50' />
                </div>
            )}

            <div className='it-container w-full flex justify-center'>
                {/* No self-animation: this hero renders in the STATIC shell, so
                    the sitewide PageTransition animates it on navigation - a
                    hydration-started MountReveal on SSR content flashes hidden
                    then re-reveals (the "shake"). */}
                <div className='relative z-10 flex w-full max-w-170.75 flex-col items-center gap-10'>
                    {/* Heading group - title + subtitle, gap 4 */}
                    <div className='flex flex-col items-center gap-1 text-center'>
                        <h1 className='m-0 font-it-body font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-hero-heading'>
                            {destinationName} {dict.toursActivities}
                        </h1>
                        <p className='m-0 max-w-138 text-base md:text-lg leading-[1.6] tracking-[-0.012em] text-it-hero-text'>
                            {dict.subtitle}
                        </p>
                    </div>

                    {/* Search group - pill + activities, gap 16 */}
                    <div className='flex w-full flex-col items-center gap-4'>
                        <DestinationHeroSearch
                            locale={locale}
                            destinationSlug={destinationSlug}
                            dict={dict}
                            search={search}
                        />

                        {/* Activities (categories) - label muted, names dark links, dots muted */}
                        {activities.length > 0 && (
                            <p className='m-0 text-center text-sm md:text-base leading-[1.6] tracking-[-0.012em] text-it-hero-text'>
                                {dict.popularLabel}:{' '}
                                {activities.map((item, i) => (
                                    <span key={item.href}>
                                        {i > 0 && <span className='mx-1.5'>·</span>}
                                        <Link
                                            href={item.href}
                                            className='text-it-hero-heading no-underline transition-colors duration-300 hover:text-it-primary'>
                                            {item.label}
                                        </Link>
                                    </span>
                                ))}
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
