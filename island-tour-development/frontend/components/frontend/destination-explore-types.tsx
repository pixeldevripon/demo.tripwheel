'use client';

import useEmblaCarousel from 'embla-carousel-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { Reveal } from './reveal';

export type ExploreType = { name: string; slug: string; tours: number; image?: string };

export function DestinationExploreTypes({
    dict,
    locale,
    destinationSlug,
    categories,
}: {
    dict: { title: string; tours: string };
    locale: Locale;
    destinationSlug: string;
    categories: ExploreType[];
}) {
    const [emblaRef, emblaApi] = useEmblaCarousel({
        align: 'start',
        containScroll: 'trimSnaps',
        dragFree: true,
    });
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
        <section className='it-section bg-it-surface'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-10 md:gap-12'>
                    <h2 className='m-0 font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {dict.title}
                    </h2>

                    <div className='relative'>
                        <div
                            ref={emblaRef}
                            className='overflow-x-scroll it-scrollbar-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden '>
                            <div className='flex gap-4 md:gap-6'>
                                {categories.map(cat => (
                                    <Link
                                        key={cat.slug}
                                        href={localizeHref(
                                            locale,
                                            `/${destinationSlug}/${cat.slug}`
                                        )}
                                        className='group relative block size-40 md:size-45 shrink-0 overflow-hidden rounded-[16px] bg-it-border'>
                                        {cat.image && (
                                            <Image
                                                src={cat.image}
                                                alt={cat.name}
                                                fill
                                                sizes='180px'
                                                className='object-cover transition-transform duration-500 ease-out group-hover:scale-105'
                                            />
                                        )}
                                        {/* Bottom scrim - transparent → #1a1a1a over the lower 77% */}
                                        <div className='pointer-events-none absolute inset-x-0 bottom-0 h-[77%] bg-linear-to-b from-transparent to-it-ink' />
                                        <div className='absolute bottom-6 left-6 flex flex-col'>
                                            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                                {cat.name}
                                            </span>
                                            <span className='text-[14px] leading-[1.6] tracking-[-0.012em] text-it-white/70'>
                                                {cat.tours} {dict.tours}
                                            </span>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Side arrows - gutter-outset on desktop; swipe on smaller screens */}
                        <button
                            type='button'
                            aria-label='Previous'
                            onClick={() => emblaApi?.scrollPrev()}
                            disabled={!canPrev}
                            className='hidden lg:grid absolute top-1/2 left-0 size-12 -translate-x-[calc(100%+16px)] -translate-y-1/2 place-items-center rounded-it-full border bg-transparent transition-colors enabled:cursor-pointer enabled:border-it-heading enabled:text-it-heading disabled:cursor-not-allowed disabled:border-[#8a8a8a]/50 disabled:text-[#8a8a8a]/50'>
                            <ChevronLeft className='size-7' strokeWidth={1.5} />
                        </button>
                        <button
                            type='button'
                            aria-label='Next'
                            onClick={() => emblaApi?.scrollNext()}
                            disabled={!canNext}
                            className='hidden lg:grid absolute top-1/2 right-0 size-12 translate-x-[calc(100%+16px)] -translate-y-1/2 place-items-center rounded-it-full border bg-transparent transition-colors enabled:cursor-pointer enabled:border-it-heading enabled:text-it-heading disabled:cursor-not-allowed disabled:border-[#8a8a8a]/50 disabled:text-[#8a8a8a]/50'>
                            <ChevronRight
                                className='size-7'
                                strokeWidth={1.5}
                            />
                        </button>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

