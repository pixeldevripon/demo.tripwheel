import Image from 'next/image';
import Link from 'next/link';

import type { SearchDict } from '@/components/frontend/navbar/lib/navbar.types';
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
 * Shipped with the app, used whenever an admin has not chosen a hero photo.
 * Local 3840x2160 original; Next's optimizer serves responsive AVIF/WebP
 * variants, so quality stays hero-grade without the 2.7 MB source ever
 * reaching a browser.
 */
const FALLBACK_HERO_IMAGE = '/images/kc-powerboat.jpg';

/**
 * Homepage hero. Server-rendered shell (heading + subtitle + the Popular island
 * links, both driven by the live destinations); the interactive island search is
 * the lone client island (`HeroSearch`).
 */
export function Hero({
    dict,
    locale,
    destinations,
    search,
    image,
    imageAlt,
}: {
    dict: HeroDict;
    locale: Locale;
    destinations: HeroDestination[];
    search: SearchDict;
    /** Admin-chosen hero photo; null/absent keeps the bundled default. */
    image?: string | null;
    /**
     * Localized alt text from the media library, resolved by the caller (the
     * loader is server-only). Falls back to a generic line - and stays generic
     * for the BUNDLED fallback photo, which is not a library asset at all.
     */
    imageAlt?: string | null;
}) {
    const popular = destinations.slice(0, 4);

    return (
        <section className='relative min-h-[520px] md:min-h-0 md:h-[clamp(500px,62vh,660px)] flex items-end justify-center bg-it-hero-bg pb-14 md:items-center md:pb-0'>
            {/* Background clips inside its own wrapper (not the section) so the
                search typeahead panel can drop below the hero without being cut. */}
            <div className='absolute inset-0 overflow-hidden'>
                {/* Photo background (token bg above stays as the loading fallback). */}
                <Image
                    src={image || FALLBACK_HERO_IMAGE}
                    // Library alt only applies when the admin's photo is the one
                    // actually rendering; the bundled fallback keeps the generic
                    // line.
                    alt={(image && imageAlt) || 'Island tours hero image'}
                    fill
                    quality={100}
                    priority
                    sizes='100vw'
                    className='object-cover scale-105 object-top md:object-[50%_42%]'
                />
                {/* Design v2 hero scrim: darker at both edges, lighter mid so
                    the white display type stays legible on any photo. */}
                <div className='absolute inset-0 bg-[image:var(--it-scrim-hero)]' />
            </div>

            {/* Centered content - 680px max (design v2 herocard) */}
            <div className='it-container relative w-full flex justify-center'>
                <div className='flex flex-col items-center gap-7 w-full max-w-[680px]'>
                    {/* Heading + subtitle */}
                    <Reveal className='flex flex-col items-center gap-3 text-center'>
                        <h1 className='m-0 font-it-body text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-balance text-it-white [text-shadow:0_2px_22px_rgba(0,0,0,0.32)] font-medium'>
                            {dict.title}
                        </h1>
                        <p className='m-0 text-base md:text-lg leading-[1.6] text-it-white/95 [text-shadow:0_1px_14px_rgba(0,0,0,0.34)] tracking-[-0.012em]'>
                            {dict.subtitle}
                        </p>
                    </Reveal>

                    {/* Search block */}
                    <Reveal
                        delay={0.3}
                        className='flex flex-col items-center gap-4 w-full max-w-[580px]'>
                        <HeroSearch
                            destinations={destinations}
                            locale={locale}
                            placeholder={dict.searchPlaceholder}
                            search={search}
                        />

                        {/* Popular - clickable destinations (live) */}
                        {popular.length > 0 && (
                            <p className='m-0 text-sm font-medium text-center text-it-white/90 [text-shadow:0_1px_10px_rgba(0,0,0,0.32)]'>
                                <span>{dict.popular}: </span>
                                {popular.map((island, i) => (
                                    <span key={island.slug}>
                                        <Link
                                            href={localizeHref(
                                                locale,
                                                `/${island.slug}`
                                            )}
                                            className='text-it-white underline underline-offset-[3px] transition-colors duration-300 hover:text-it-primary-subtle text-sm lg:text-base leading-[1.6] tracking-[-0.012em]'>
                                            {island.name}
                                        </Link>
                                        {i < popular.length - 1 && (
                                            <span className='opacity-60'>
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

