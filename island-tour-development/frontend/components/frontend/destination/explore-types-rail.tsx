'use client';

import Autoplay from 'embla-carousel-autoplay';
import useEmblaCarousel from 'embla-carousel-react';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';

import { localizeHref, type Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import { MotionLink } from '../motion-link';
import { Reveal } from '../reveal';

export type ExploreType = {
    name: string;
    slug: string;
    tours: number;
    image?: string;
};

/** Auto-advance interval for the card slider (ms). Tune here. */
const AUTO_ADVANCE_MS = 8000;

/**
 * Dwell on the FIRST card before the rail starts moving (ms). The rail leads
 * with the destination's best seller (Klein Curaçao on Curaçao), so the
 * opening card holds longer than the rest; also applies each time autoplay
 * wraps back to the start. Tune here.
 */
const FIRST_CARD_ADVANCE_MS = 30000;

/**
 * The horizontal rail of category/hub tiles - image, name, live tour count -
 * with round overlapping arrows on desktop and swipe below it.
 *
 * HEADLESS ON PURPOSE: no section wrapper, no heading, no background. The
 * destination page's "Explore by type" section supplies those (kicker + title +
 * "All {destination} tours" link), and the search recovery band mounts the rail
 * ALONE, straight under its own head. Splitting the two is what lets the search
 * page reuse the real thing rather than grow a second, slightly different
 * carousel that drifts on the first design tweak.
 */
export function ExploreTypesRail({
    locale,
    destinationSlug,
    categories,
    toursLabel,
    tileFallbackClassName = 'bg-it-bg',
    linkQuery,
}: {
    locale: Locale;
    destinationSlug: string;
    categories: ExploreType[];
    /** Plural noun after the count - e.g. "tours". */
    toursLabel: string;
    /**
     * Background of a tile whose target has no hero image yet. It has to
     * CONTRAST WITH WHAT THE RAIL IS SITTING ON: the default `bg-it-bg` reads
     * as an empty tile on the destination page's white section and vanishes
     * completely inside the search recovery band, which is `bg-it-surface` -
     * the same grey - leaving a title and a count floating over nothing.
     */
    tileFallbackClassName?: string;
    /**
     * Already-encoded query string (no leading `?`) appended to every tile
     * href - the search recovery band uses it to carry the traveller's chosen
     * DATE onto whatever page they open, so the date they picked does not
     * silently reset the moment they follow a suggestion.
     */
    linkQuery?: string;
}) {
    // Auto-advance: one card every AUTO_ADVANCE_MS, except the first card,
    // which holds for FIRST_CARD_ADVANCE_MS (per-snap delay array). Pauses on
    // hover (stopOnMouseEnter) and while dragging, resumes after
    // (stopOnInteraction: false), and scrolls back to the first card at the
    // end (plugin default when embla `loop` is off). Skipped entirely under
    // reduced motion.
    const reduceMotion = useReducedMotion();
    const [emblaRef, emblaApi] = useEmblaCarousel(
        { align: 'start', containScroll: 'trimSnaps', dragFree: true },
        reduceMotion
            ? []
            : [
                  Autoplay({
                      delay: scrollSnaps =>
                          scrollSnaps.map((_, index) =>
                              index === 0
                                  ? FIRST_CARD_ADVANCE_MS
                                  : AUTO_ADVANCE_MS
                          ),
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

    return (
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
                                    `/${destinationSlug}/${cat.slug}${
                                        linkQuery ? `?${linkQuery}` : ''
                                    }`
                                )}
                                whileTap={{ scale: 0.98 }}
                                transition={springPop}
                                className='group block w-[38vw] sm:w-[196px] shrink-0 rounded-it-md no-underline transition-transform duration-(--it-duration-sm) ease-(--it-ease) hover:-translate-y-0.5'>
                                {/* Hairline border so the tile still reads as
                                    a tile when the image is missing, whatever
                                    it is sitting on. */}
                                <div
                                    className={`relative aspect-4/3 overflow-hidden rounded-it-md border border-it-border ${tileFallbackClassName}`}>
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
                                <b className='mt-2.5 block text-[14.5px] font-medium tracking-[-0.012em] text-it-ink'>
                                    {cat.name}
                                </b>
                                <span className='text-[12.5px] leading-[1.6] text-it-text-muted tabular-nums'>
                                    {cat.tours} {toursLabel}
                                </span>
                            </MotionLink>
                        </Reveal>
                    ))}
                </div>
            </div>

            {/* Round rail arrows overlapping the edges (design v2 .catnav);
                swipe on smaller screens */}
            <motion.button
                type='button'
                aria-label='Previous'
                onClick={() => emblaApi?.scrollPrev()}
                disabled={!canPrev}
                whileTap={canPrev ? { scale: 0.9 } : undefined}
                transition={springPop}
                className='hidden lg:flex absolute top-[calc(50%-34px)] -left-3.5 z-5 size-9 items-center justify-center rounded-full border border-it-divider bg-it-white shadow-it-md transition-opacity enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'>
                <ChevronLeft className='size-4 text-it-ink' strokeWidth={1.5} />
            </motion.button>
            <motion.button
                type='button'
                aria-label='Next'
                onClick={() => emblaApi?.scrollNext()}
                disabled={!canNext}
                whileTap={canNext ? { scale: 0.9 } : undefined}
                transition={springPop}
                className='hidden lg:flex absolute top-[calc(50%-34px)] -right-3.5 z-5 size-9 items-center justify-center rounded-full border border-it-divider bg-it-white shadow-it-md transition-opacity enabled:cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'>
                <ChevronRight className='size-4 text-it-ink' strokeWidth={1.5} />
            </motion.button>
        </div>
    );
}
