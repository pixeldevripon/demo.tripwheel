import Link from 'next/link';

import { localizeHref, type Locale } from '@/lib/constants/locales';

import { HeroSearch } from './hero-search';
import type { HeroDestination } from './lib/hero.types';

type HeroDict = {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    popular: string;
};

/**
 * Homepage hero. Server-rendered shell (heading + subtitle + the Popular island
 * links, both driven by the live destinations); the interactive island search is
 * the lone client island (`HeroSearch`).
 */
export function Hero({
    dict,
    locale,
    destinations,
}: {
    dict: HeroDict;
    locale: Locale;
    destinations: HeroDestination[];
}) {
    const popular = destinations.slice(0, 4);

    return (
        <section className='relative h-136.75 md:h-150 flex items-end justify-center overflow-hidden bg-it-hero-bg [background-image:var(--it-hero-gradient)] pb-12 md:items-center md:pb-0'>
            {/* Centered content - 841px max */}
            <div className='it-container w-full flex justify-center'>
                <div className='flex flex-col items-center gap-10 w-full max-w-220.25'>
                    {/* Heading + subtitle */}
                    <div className='flex flex-col items-center gap-1 text-center'>
                        <h1 className='m-0 font-it-body font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-hero-heading'>
                            {dict.title}
                        </h1>
                        <p className='m-0 text-base md:text-lg leading-[1.6] tracking-[-0.012em] text-it-hero-text'>
                            {dict.subtitle}
                        </p>
                    </div>

                    {/* Search block */}
                    <div className='flex flex-col items-center gap-4 w-full max-w-171.25'>
                        <HeroSearch
                            destinations={destinations}
                            locale={locale}
                            placeholder={dict.searchPlaceholder}
                        />

                        {/* Popular - clickable destinations (live) */}
                        {popular.length > 0 && (
                            <p className='m-0 text-sm md:text-base tracking-[-0.012em] text-center'>
                                <span className='text-it-hero-text'>
                                    {dict.popular}:{' '}
                                </span>
                                {popular.map((island, i) => (
                                    <span key={island.slug}>
                                        <Link
                                            href={localizeHref(locale, `/${island.slug}`)}
                                            className='text-it-hero-heading no-underline transition-colors hover:text-it-primary'>
                                            {island.name}
                                        </Link>
                                        {i < popular.length - 1 && (
                                            <span className='text-it-hero-heading'>
                                                {' '}
                                                ·{' '}
                                            </span>
                                        )}
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
