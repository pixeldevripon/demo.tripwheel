'use client';

import { localizeHref, type Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { MotionLink } from '../motion-link';
import { Reveal } from '../reveal';

export type ExploreType = {
    name: string;
    slug: string;
    tours: number;
    image?: string;
};

/** Auto-advance interval for the card slider (ms). Tune here. */
const AUTO_ADVANCE_MS = 4000;

export function DestinationExploreTypes({
    dict,
    locale,
    destinationSlug,
    destinationName,
    categories,
}: {
    dict: {
        title: string;
        tours: string;
        /** "All {destination} tours" - the section head's link label. */
        allTours: string;
    };
    locale: Locale;
    destinationSlug: string;
    /** Island display name - the section head's kicker + link label. */
    destinationName: string;
    categories: ExploreType[];
}) {
    // Auto-advance: one card every AUTO_ADVANCE_MS. Pauses on hover
    // (stopOnMouseEnter) and while dragging, resumes after (stopOnInteraction:
    // false), and scrolls back to the first card at the end (plugin default
    // when embla `loop` is off). Skipped entirely under reduced motion.
    const reduceMotion = useReducedMotion();
    const [emblaRef, emblaApi] = useEmblaCarousel(
        { align: 'start', containScroll: 'trimSnaps', dragFree: true },
        reduceMotion
            ? []
            : [
                  Autoplay({
                      delay: AUTO_ADVANCE_MS,
                      stopOnInteraction: false,
                      stopOnMouseEnter: true,
                  }),
              ]
    );
    const [canPrev, setCanPrev] = useState(false);
    const [canNext, setCanNext] = useState(false);

    const onSelect = useCallback(() => {
        if (!emblaApi) return;
        setCanPrev(emblaApi.canScrollPrev());
        setCanNext(emblaApi.canScrollNext());
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        onSelect();
        emblaApi.on('select', onSelect).on('reInit', onSelect);
        return () => {
            emblaApi.off('select', onSelect).off('reInit', onSelect);
        };
    }, [emblaApi, onSelect]);

    const allToursHref = localizeHref(locale, `/${destinationSlug}/tours`);

    return (
        <section className='bg-it-white pt-11 md:pt-14'>
            <div className='it-container'>
                {/* Static-shell section: PageTransition owns the page-enter, so no
                    section-level mount animation (it would flash on hydration).
                    The cards stagger on scroll instead. */}
                <Reveal className='flex flex-col gap-5'>
                    {/* Section head: kicker + title left, all-tours link right */}
                    <div className='flex items-end justify-between gap-6'>
                        <div>
                            <div className='mb-2 text-[11.5px] font-medium uppercase tracking-[0.13em] text-it-primary-hover'>
                                {destinationName}
                            </div>
                            <h2 className='m-0 text-[clamp(22px,2.6vw,30px)] leading-[1.1] tracking-[-0.015em] font-medium text-it-ink'>
                                {dict.title}
                            </h2>
                        </div>
                        <Link
                            href={allToursHref}
                            className='whitespace-nowrap text-sm font-medium text-it-primary-hover underline underline-offset-[3px] max-sm:hidden'>
                            {dict.allTours.replace(
                                '{destination}',
                                destinationName
                            )}{' '}
                            →
                        </Link>
                    </div>

                    <div className='relative'>
                        <div
                            ref={emblaRef}
                            className='overflow-x-scroll overflow-y-hidden it-scrollbar-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden '>
                            <div className='flex gap-3.5 px-1 py-1'>
                                {categories.map(cat => (
                                    <Reveal
                                        key={cat.slug}
                                        width='auto'
                                        listItem
                                        className='shrink-0'>
                                        <MotionLink
                                            href={localizeHref(
                                                locale,
                                                `/${destinationSlug}/${cat.slug}`
                                            )}
                                            whileTap={{ scale: 0.98 }}
                                            transition={springPop}
                                            className='group block w-[38vw] sm:w-[196px] shrink-0 rounded-it-md no-underline transition-transform duration-(--it-duration-sm) ease-(--it-ease) hover:-translate-y-0.5'>
                                            <div className='relative aspect-4/3 overflow-hidden rounded-it-md bg-it-bg'>
                                                {cat.image && (
                                                    <Image
                                                        src={cat.image}
                                                        alt={cat.name}
                                                        fill
                                                        sizes='196px'
                                                        className='object-cover transition-transform duration-(--it-duration-md) ease-(--it-ease) group-hover:scale-[1.03]'
                                                    />
                                                )}
                                            </div>
                                            <b className='mt-2.5 block text-[14.5px] font-medium tracking-[-0.005em] text-it-ink'>
                                                {cat.name}
                                            </b>
                                            <span className='text-[12.5px] leading-[1.6] text-it-text-muted tabular-nums'>
                                                {cat.tours} {dict.tours}
                                            </span>
                                        </MotionLink>
                                    </Reveal>
                                ))}
                            </div>
                        </div>

                        {/* Round rail arrows overlapping the edges (design v2
                            .catnav); swipe on smaller screens */}
                        <motion.button
                            type='button'
                            aria-label='Previous'
                            onClick={() => emblaApi?.scrollPrev()}
                            disabled={!canPrev}
                            whileTap={canPrev ? { scale: 0.9 } : undefined}
                            transition={springPop}
                            className='hidden lg:flex absolute top-[calc(50%-34px)] -left-3.5 z-5 size-9 items-center justify-center rounded-full border border-it-divider bg-it-white shadow-it-md transition-opacity enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'>
                            <ChevronLeft
                                className='size-4 text-it-ink'
                                strokeWidth={1.5}
                            />
                        </motion.button>
                        <motion.button
                            type='button'
                            aria-label='Next'
                            onClick={() => emblaApi?.scrollNext()}
                            disabled={!canNext}
                            whileTap={canNext ? { scale: 0.9 } : undefined}
                            transition={springPop}
                            className='hidden lg:flex absolute top-[calc(50%-34px)] -right-3.5 z-5 size-9 items-center justify-center rounded-full border border-it-divider bg-it-white shadow-it-md transition-opacity enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'>
                            <ChevronRight
                                className='size-4 text-it-ink'
                                strokeWidth={1.5}
                            />
                        </motion.button>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

