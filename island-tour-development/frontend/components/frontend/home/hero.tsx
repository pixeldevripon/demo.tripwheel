import Image from 'next/image';
import Link from 'next/link';

import { localizeHref, type Locale } from '@/lib/constants/locales';

import { Reveal } from '../reveal';
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
        <section className='relative h-136.75 md:h-150 2xl:h-180 flex items-end justify-center overflow-hidden bg-it-hero-bg  pb-12 md:items-center md:pb-0'>
            {/* Photo background (token bg above stays as the loading fallback).
                Local 3840x2160 original; Next's optimizer serves responsive
                AVIF/WebP variants, so quality stays hero-grade without the
                2.7 MB source ever reaching a browser. */}
            <Image
                src='/images/kc-powerboat.jpg'
                alt='Island tours hero image'
                fill
                quality={100}
                priority
                sizes='100vw'
                className='object-cover scale-105  object-top md:object-[80%_40%]'
            />
            {/* Soft veil so the ink heading/subtitle stay legible on the photo */}
            <div className='absolute inset-0 bg-black/40' />

            {/* Centered content - 841px max */}
            <div className='it-container relative w-full flex justify-center'>
                <div className='flex flex-col items-center gap-10 w-full max-w-220.25'>
                    {/* Heading + subtitle */}
                    <Reveal className='flex flex-col items-center gap-1 text-center'>
                        <h1 className='m-0 font-it-body font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-primary-fg'>
                            {dict.title}
                        </h1>
                        <p className='m-0 text-base md:text-lg leading-[1.6] tracking-[-0.012em] text-it-primary-subtle'>
                            {dict.subtitle}
                        </p>
                    </Reveal>

                    {/* Search block */}
                    <Reveal
                        delay={0.3}
                        className='flex flex-col items-center gap-4 w-full max-w-171.25'>
                        <HeroSearch
                            destinations={destinations}
                            locale={locale}
                            placeholder={dict.searchPlaceholder}
                        />

                        {/* Popular - clickable destinations (live) */}
                        {popular.length > 0 && (
                            <p className='m-0 text-sm md:text-base tracking-[-0.012em] text-center'>
                                <span className='text-it-primary-fg'>
                                    {dict.popular}:{' '}
                                </span>
                                {popular.map((island, i) => (
                                    <span key={island.slug}>
                                        <Link
                                            href={localizeHref(
                                                locale,
                                                `/${island.slug}`
                                            )}
                                            className='text-it-primary-subtle no-underline transition-colors duration-300 hover:text-it-primary'>
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
                    </Reveal>
                </div>
            </div>
        </section>
    );
}


