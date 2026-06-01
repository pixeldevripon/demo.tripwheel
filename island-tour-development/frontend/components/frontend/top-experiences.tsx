'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Play } from 'lucide-react';
import { Reveal } from './reveal';

type CardKey =
    | 'sunsetCruise'
    | 'catamaranTrip'
    | 'buggyTour'
    | 'snorkeling'
    | 'dolphin';

type Card = {
    key: CardKey;
    image: string | null;
    video: string | null;
};

type ExperiencesDict = {
    title: string;
    cards: Record<CardKey, string>;
};

const cards: Card[] = [
    {
        key: 'sunsetCruise',
        image: '/images/home-page/experiences/sunset-cruise.jpg',
        video: '/videos/experiences/sunset-cruise.mp4',
    },
    {
        key: 'catamaranTrip',
        image: '/images/home-page/experiences/catamaran-trip.jpg',
        video: '/videos/experiences/catamaran-trip.mp4',
    },
    {
        key: 'buggyTour',
        image: '/images/home-page/experiences/buggy-tour.jpg',
        video: '/videos/experiences/buggy-tour.mp4',
    },
    { key: 'snorkeling', image: null, video: null },
    { key: 'dolphin', image: null, video: null },
];

const REAL = cards.length;
// Repeat the set so the track overflows the viewport — required for a seamless infinite loop
const SLIDES = [...cards, ...cards, ...cards];
const START = REAL + 2; // centre the middle card (Buggy) of the middle set

// Figma arc — tallest card in the centre, shrinking toward the edges
const SLIDE_W = 220;
const GAP = 24;
const H_MAX = 403;
const H_MIN = 333;

export function TopExperiences({ dict }: { dict: ExperiencesDict }) {
    const autoplay = useRef(
        Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })
    );
    const [emblaRef, emblaApi] = useEmblaCarousel(
        { loop: true, align: 'center', containScroll: false, startIndex: START },
        [autoplay.current]
    );

    const [selected, setSelected] = useState(START);
    const [playing, setPlaying] = useState<number | null>(null);

    // Height varies by each slide's live distance from the carousel centre
    const applyHeights = useCallback(() => {
        if (!emblaApi) return;
        const rect = emblaApi.rootNode().getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        emblaApi.slideNodes().forEach((slide) => {
            const card = slide.firstElementChild as HTMLElement | null;
            if (!card) return;
            const r = slide.getBoundingClientRect();
            const slideCenter = r.left + r.width / 2;
            const step = Math.abs(slideCenter - center) / (SLIDE_W + GAP);
            const h = Math.round(H_MAX - (H_MAX - H_MIN) * Math.min(step / 2, 1));
            card.style.height = `${h}px`;
        });
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
        onSelect();
        applyHeights();
        emblaApi.on('select', onSelect);
        emblaApi.on('scroll', applyHeights);
        emblaApi.on('reInit', applyHeights);
        return () => {
            emblaApi.off('select', onSelect);
            emblaApi.off('scroll', applyHeights);
            emblaApi.off('reInit', applyHeights);
        };
    }, [emblaApi, applyHeights]);

    const handlePlay = (index: number) => {
        setPlaying(index);
        autoplay.current.stop();
    };

    // 3 dots — left / centre / right
    const realIndex = ((selected % REAL) + REAL) % REAL;
    const activeDot = realIndex <= 1 ? 0 : realIndex === 2 ? 1 : 2;
    const goToDot = (dot: number) => {
        if (!emblaApi) return;
        const targetReal = dot === 0 ? 0 : dot === 1 ? 2 : 4;
        const base = selected - realIndex;
        emblaApi.scrollTo(base + targetReal);
    };

    return (
        <section className='it-section bg-it-white'>
            <div className='it-container'>
                <Reveal className='flex flex-col items-center gap-10'>
                    <h2 className='m-0 font-medium text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading text-center'>
                        {dict.title}
                    </h2>

                    {/* Carousel */}
                    <div className='w-full overflow-hidden' ref={emblaRef}>
                        <div className='flex items-center gap-6' style={{ height: H_MAX }}>
                            {SLIDES.map((card, i) => {
                                const hasMedia = Boolean(card.image);
                                const isPlaying = playing === i && Boolean(card.video);
                                const title = dict.cards[card.key];
                                return (
                                    <div key={`${card.key}-${i}`} className='shrink-0 w-55'>
                                        <div
                                            className='relative w-full overflow-hidden rounded-it-lg'
                                            style={{ height: H_MIN }}
                                        >
                                            {isPlaying ? (
                                                <video
                                                    src={card.video as string}
                                                    poster={card.image ?? undefined}
                                                    autoPlay
                                                    controls
                                                    loop
                                                    muted={false}
                                                    playsInline
                                                    className='absolute inset-0 size-full object-cover'
                                                />
                                            ) : (
                                                <>
                                                    {hasMedia ? (
                                                        <Image
                                                            src={card.image as string}
                                                            alt={title}
                                                            fill
                                                            sizes='220px'
                                                            className='object-cover'
                                                        />
                                                    ) : (
                                                        <div className='absolute inset-0 bg-it-border' />
                                                    )}

                                                    {card.video ? (
                                                        <button
                                                            type='button'
                                                            aria-label={`Play ${title} video`}
                                                            onClick={() => handlePlay(i)}
                                                            className='absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-it-white/30 backdrop-blur-sm cursor-pointer border-none transition-colors hover:bg-it-white/50'
                                                        >
                                                            <Play className='size-3.5 fill-it-white text-it-white' />
                                                        </button>
                                                    ) : (
                                                        <span className='absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-it-white/40'>
                                                            <Play className='size-3.5 fill-it-ink-muted text-it-ink-muted' />
                                                        </span>
                                                    )}

                                                    <p
                                                        className={[
                                                            'absolute bottom-4 inset-x-8 m-0 text-center font-medium text-[20px] leading-[1.6] tracking-[-0.012em]',
                                                            hasMedia ? 'text-it-white' : 'text-it-heading',
                                                        ].join(' ')}
                                                    >
                                                        {title}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pagination — 3 dots: left / centre / right */}
                    <div className='flex items-center gap-2'>
                        {[0, 1, 2].map((dot) => (
                            <button
                                key={dot}
                                type='button'
                                aria-label={`Go to ${['left', 'centre', 'right'][dot]} slides`}
                                onClick={() => goToDot(dot)}
                                className={[
                                    'h-1.5 w-12 rounded-full transition-colors cursor-pointer border-none',
                                    dot === activeDot ? 'bg-it-ink-muted' : 'bg-it-border',
                                ].join(' ')}
                            />
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
