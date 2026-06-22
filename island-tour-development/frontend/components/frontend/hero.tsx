'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { localizeHref, type Locale } from '@/lib/constants/locales';

type HeroDict = {
    title: string;
    subtitle: string;
    searchPlaceholder: string;
    popular: string;
};

// Popular destinations - island names are proper nouns; only the URL is localized.
const popularIslands = [
    { name: 'Curaçao', slug: 'curacao' },
    { name: 'Aruba', slug: 'aruba' },
    { name: 'Sint Maarten', slug: 'sint-maarten' },
];

export function Hero({ dict, locale }: { dict: HeroDict; locale: Locale }) {
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
                        {/* Search bar */}
                        <div className='flex items-center justify-between gap-2 w-full bg-it-white rounded-it-full h-15 md:h-20 pl-5 md:pl-9 pr-2.5 md:pr-3'>
                            <div className='flex items-center gap-2 flex-1'>
                                <Image
                                    src='/icons/hero-location.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6 shrink-0'
                                />
                                <input
                                    type='text'
                                    placeholder={dict.searchPlaceholder}
                                    className='flex-1 border-none outline-none bg-transparent text-base tracking-[-0.012em] text-it-ink placeholder:text-it-hero-text'
                                />
                            </div>
                            <motion.button
                                aria-label='Search'
                                className='shrink-0 flex items-center justify-center size-10 md:size-12.5 rounded-it-full bg-it-primary hover:bg-it-primary-hover transition-colors border-none cursor-pointer'
                                initial='rest'
                                whileHover='hover'
                                whileTap='tap'
                                animate='rest'
                                variants={{ rest: { scale: 1 }, hover: { scale: 1.06 }, tap: { scale: 0.92 } }}
                                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                            >
                                <motion.span
                                    className='inline-flex'
                                    variants={{ rest: { x: 0 }, hover: { x: 3 }, tap: { x: 7 } }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                >
                                    <Image
                                        src='/icons/hero-arrow-right.svg'
                                        alt=''
                                        width={24}
                                        height={24}
                                        className='size-5 md:size-6'
                                    />
                                </motion.span>
                            </motion.button>
                        </div>

                        {/* Popular - clickable destinations */}
                        <p className='m-0 text-sm md:text-base tracking-[-0.012em] text-center'>
                            <span className='text-it-hero-text'>{dict.popular}: </span>
                            {popularIslands.map((island, i) => (
                                <span key={island.slug}>
                                    <Link
                                        href={localizeHref(locale, `/${island.slug}`)}
                                        className='text-it-hero-heading no-underline transition-colors hover:text-it-primary'>
                                        {island.name}
                                    </Link>
                                    {i < popularIslands.length - 1 && (
                                        <span className='text-it-hero-heading'> · </span>
                                    )}
                                </span>
                            ))}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}
