'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { Pause, Play } from 'lucide-react';
import { crossFade, springPop } from '@/lib/motion';
import { Reveal } from '../reveal';

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
// Repeat the set so the track overflows the viewport - required for a seamless infinite loop
const SLIDES = [...cards, ...cards, ...cards];
const START = REAL + 2; // centre the middle card (Buggy) of the middle set

// Figma arc - tallest card in the centre, shrinking toward the edges
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
    const [paused, setPaused] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Mirror of `playing` for the embla event handlers below (registered once).
    const playingRef = useRef<number | null>(null);
    useEffect(() => {
        playingRef.current = playing;
    }, [playing]);

    // `stopOnInteraction: false` + `stopOnMouseEnter` re-arm the autoplay timer
    // after any drag or hover-leave, silently undoing the `.stop()` from
    // handlePlay - the reel would slide away mid-video. Re-stop on every resume
    // path (plugin event, drag release, and the root's own mouseleave, which
    // resumes without emitting an event). The stop is DEFERRED a tick because a
    // synchronous stop() inside the plugin's own dispatch gets re-armed.
    useEffect(() => {
        if (!emblaApi) return;
        const holdWhileVideoPlays = () => {
            if (playingRef.current === null) return;
            setTimeout(() => {
                if (playingRef.current !== null) autoplay.current.stop();
            }, 0);
        };
        const root = emblaApi.rootNode();
        emblaApi.on('autoplay:play', holdWhileVideoPlays);
        emblaApi.on('pointerUp', holdWhileVideoPlays);
        root.addEventListener('mouseleave', holdWhileVideoPlays);
        return () => {
            emblaApi.off('autoplay:play', holdWhileVideoPlays);
            emblaApi.off('pointerUp', holdWhileVideoPlays);
            root.removeEventListener('mouseleave', holdWhileVideoPlays);
        };
    }, [emblaApi]);

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
        setPaused(false);
        autoplay.current.stop();
    };

    // Toggle the currently mounted video between play and pause (same button)
    const toggleVideo = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) void v.play();
        else v.pause();
    };

    // 3 dots - left / centre / right
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

                    {/* Carousel - drag to swipe (Embla handles pointer + touch) */}
                    <div
                        className='w-full overflow-hidden cursor-grab select-none active:cursor-grabbing'
                        ref={emblaRef}
                    >
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
                                            {/* Base layer - the image stays mounted for the video's
                                                whole life (and doubles as its poster), so pressing
                                                play never flashes: the video simply cross-fades in
                                                above the identical frame. */}
                                            {hasMedia ? (
                                                <Image
                                                    src={card.image as string}
                                                    alt={title}
                                                    fill
                                                    sizes='220px'
                                                    draggable={false}
                                                    className='object-cover'
                                                />
                                            ) : (
                                                <div className='absolute inset-0 bg-it-border' />
                                            )}

                                            {/* No exit animation on purpose: the old card's video
                                                unmounts instantly and its always-mounted base image
                                                shows through (no flash), so exactly ONE video ever
                                                exists - keeping the shared ref + pause state honest. */}
                                            {isPlaying && (
                                                <motion.video
                                                    // Assign-only ref: never let a departing video's
                                                    // cleanup null the ref after the new one claimed it.
                                                    ref={el => {
                                                        if (el) videoRef.current = el;
                                                    }}
                                                    src={card.video as string}
                                                    poster={card.image ?? undefined}
                                                    autoPlay
                                                    loop
                                                    muted={false}
                                                    playsInline
                                                    // Only the CURRENT video drives the paused state -
                                                    // a departing video fires pause on unmount and
                                                    // would flip the fresh card's icon.
                                                    onPlay={e => {
                                                        if (e.currentTarget === videoRef.current)
                                                            setPaused(false);
                                                    }}
                                                    onPause={e => {
                                                        if (e.currentTarget === videoRef.current)
                                                            setPaused(true);
                                                    }}
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    transition={crossFade}
                                                    className='absolute inset-0 size-full object-cover'
                                                />
                                            )}

                                            {/* One control - play, then pause/resume in place; the
                                                icon springs between states like the TYP copy chip. */}
                                            {card.video ? (
                                                <motion.button
                                                    type='button'
                                                    aria-label={
                                                        isPlaying
                                                            ? `${paused ? 'Play' : 'Pause'} ${title} video`
                                                            : `Play ${title} video`
                                                    }
                                                    onClick={
                                                        isPlaying
                                                            ? toggleVideo
                                                            : () => handlePlay(i)
                                                    }
                                                    // Keep the press away from Embla's drag watcher -
                                                    // a micro-movement during the press otherwise
                                                    // registers as a drag and swallows the click.
                                                    onPointerDown={e =>
                                                        e.stopPropagation()
                                                    }
                                                    whileTap={{ scale: 0.9 }}
                                                    transition={springPop}
                                                    className='absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-it-white/30 backdrop-blur-sm cursor-pointer border-none transition-colors hover:bg-it-white/50'
                                                >
                                                    <AnimatePresence mode='wait' initial={false}>
                                                        <motion.span
                                                            key={isPlaying && !paused ? 'pause' : 'play'}
                                                            initial={{ scale: 0 }}
                                                            animate={{ scale: 1 }}
                                                            exit={{ scale: 0 }}
                                                            transition={springPop}
                                                            className='inline-flex'
                                                        >
                                                            {isPlaying && !paused ? (
                                                                <Pause className='size-3.5 fill-it-white text-it-white' />
                                                            ) : (
                                                                <Play className='size-3.5 fill-it-white text-it-white' />
                                                            )}
                                                        </motion.span>
                                                    </AnimatePresence>
                                                </motion.button>
                                            ) : (
                                                <span className='absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-it-white/40'>
                                                    <Play className='size-3.5 fill-it-ink-muted text-it-ink-muted' />
                                                </span>
                                            )}

                                            <AnimatePresence initial={false}>
                                                {!isPlaying && (
                                                    <motion.p
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        exit={{ opacity: 0 }}
                                                        transition={crossFade}
                                                        className={[
                                                            'absolute bottom-4 inset-x-8 m-0 text-center font-medium text-[20px] leading-[1.6] tracking-[-0.012em]',
                                                            hasMedia ? 'text-it-white' : 'text-it-heading',
                                                        ].join(' ')}
                                                    >
                                                        {title}
                                                    </motion.p>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Pagination - 3 dots: left / centre / right */}
                    <div className='flex items-center gap-2'>
                        {[0, 1, 2].map((dot) => (
                            <motion.button
                                key={dot}
                                type='button'
                                aria-label={`Go to ${['left', 'centre', 'right'][dot]} slides`}
                                onClick={() => goToDot(dot)}
                                whileTap={{ scale: 0.9 }}
                                transition={springPop}
                                className={[
                                    'h-1.5 w-12 rounded-full transition-colors duration-300 cursor-pointer border-none',
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
