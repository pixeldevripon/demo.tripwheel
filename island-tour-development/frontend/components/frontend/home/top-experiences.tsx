'use client';

import { crossFade, springPop } from '@/lib/motion';
import useEmblaCarousel from 'embla-carousel-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Reveal } from '../reveal';

type CardKey =
    | 'sunsetCruise'
    | 'catamaranTrip'
    | 'buggyTour'
    | 'snorkeling'
    | 'dolphin';

type Card = { key: CardKey; image: string | null; video: string | null };

type ExperiencesDict = { title: string; cards: Record<CardKey, string> };

/**
 * Cloudinary delivery transformations, injected right after `/upload/`.
 * Cards render at 220px wide (~440px at 2x DPR), so w_640 + c_limit keeps
 * crisp retina quality while cutting the raw PNG/MP4 payloads dramatically.
 * Images: f_auto picks AVIF/WebP per browser, q_auto balances quality/size.
 * Videos: vc_auto picks the codec (H.265/VP9 where supported), q_auto ditto.
 */
const CLD_IMAGE_TX = 'f_auto,q_auto,w_640,c_limit';
const CLD_VIDEO_TX = 'q_auto,vc_auto,w_640,c_limit';

const cld = (url: string, transform: string) =>
    url.replace('/upload/', `/upload/${transform}/`);

const RAW_CARDS: Card[] = [
    {
        key: 'sunsetCruise',
        image: 'https://res.cloudinary.com/dsfms7jb4/image/upload/v1784296713/sunset-cruise_sciih4.png',
        video: 'https://res.cloudinary.com/dsfms7jb4/video/upload/v1784296702/sunset-cruise_qojtp4.mp4',
    },
    {
        key: 'catamaranTrip',
        image: 'https://res.cloudinary.com/dsfms7jb4/image/upload/v1784296713/catamaran-trip_s5njba.png',
        video: 'https://res.cloudinary.com/dsfms7jb4/video/upload/v1784296701/catamaran-trip_zohlkt.mp4',
    },
    {
        key: 'buggyTour',
        image: 'https://res.cloudinary.com/dsfms7jb4/image/upload/v1784296714/buggy-tour_iwaavw.png',
        video: 'https://res.cloudinary.com/dsfms7jb4/video/upload/v1784296700/buggy-tour_xy8ctp.mp4',
    },
    // Placeholder media (only 3 shoots exist today): reuse the closest pair so
    // no card ever renders as an empty grey box. Swap for real assets when shot.
    {
        key: 'snorkeling',
        image: 'https://res.cloudinary.com/dsfms7jb4/image/upload/v1784296713/catamaran-trip_s5njba.png',
        video: 'https://res.cloudinary.com/dsfms7jb4/video/upload/v1784296701/catamaran-trip_zohlkt.mp4',
    },
    {
        key: 'dolphin',
        image: 'https://res.cloudinary.com/dsfms7jb4/image/upload/v1784296713/sunset-cruise_sciih4.png',
        video: 'https://res.cloudinary.com/dsfms7jb4/video/upload/v1784296702/sunset-cruise_qojtp4.mp4',
    },
];

const cards: Card[] = RAW_CARDS.map(card => ({
    ...card,
    image: card.image && cld(card.image, CLD_IMAGE_TX),
    video: card.video && cld(card.video, CLD_VIDEO_TX),
}));

const REAL = cards.length;
// Repeat the set so the track overflows the viewport - required for a seamless infinite loop
const SLIDES = [...cards, ...cards, ...cards];
const START = REAL + 2; // centre the middle card (Buggy) of the middle set

// Size arc (reference: Fever-style reel) - the centre card renders at full
// 250x440, neighbours at ~0.85x, outer cards at ~0.7x. Cards scale
// PROPORTIONALLY (width + height together) via transform, and a translate
// correction pulls the shrunken cards inward so the visual gaps stay even
// instead of growing toward the edges.
const SLIDE_W = 250;
const GAP = 18;
const H_MAX = 440;
/** Scale by distance-from-centre in slide units: 1 -> 0.85 -> 0.7, clamped. */
const SCALE_STEP = 0.15;
const SCALE_MIN = 0.7;
const arcScale = (d: number) => Math.max(1 - SCALE_STEP * d, SCALE_MIN);
/**
 * How far a slide at distance `d` must shift toward the centre so the packed
 * look holds: the integral of the accumulated scale insets, W * ∫(1-scale).
 * For scale(t)=1-0.15t (floored at 0.7 from t=2): 0.075d² up to d=2, then
 * linear at the 0.3 floor.
 */
const arcShift = (d: number) =>
    SLIDE_W * (d <= 2 ? 0.075 * d * d : 0.3 * (d - 2) + 0.3);

/**
 * Exactly five packed cards fill the viewport: centre (1x) + two neighbours
 * (0.85x) + two outer (0.7x) + four gaps. Capping the embla viewport at this
 * width keeps the sixth/seventh loop slides fully outside it - no cropped
 * slivers at the edges.
 */
const VIEWPORT_W = Math.round(SLIDE_W * (1 + 2 * 0.85 + 2 * 0.7) + 4 * GAP);

export function TopExperiences({ dict }: { dict: ExperiencesDict }) {
    // No timer-driven autoplay: the reel is video-driven. The CENTRE card's
    // video always plays; when it ends, `onEnded` advances the carousel and
    // the next centred card takes over.
    const [emblaRef, emblaApi] = useEmblaCarousel({
        loop: true,
        align: 'center',
        containScroll: false,
        startIndex: START,
        // Longer tween for scrollTo/scrollNext - Embla eases with a cubic
        // curve, so this reads as a smooth "cubic swipe" into the centre.
        duration: 35,
    });

    const [selected, setSelected] = useState(START);
    const [paused, setPaused] = useState(false);
    // Automatic playback (page load, ended-advance) must start muted or the
    // browser blocks it; the first explicit play click unlocks sound.
    const [soundOn, setSoundOn] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);

    // Size arc: each card scales (and shifts inward) by its live distance from
    // the carousel centre, re-applied on every scroll frame so the arc morphs
    // continuously while dragging/sliding.
    const applyArc = useCallback(() => {
        if (!emblaApi) return;
        const rect = emblaApi.rootNode().getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        emblaApi.slideNodes().forEach(slide => {
            const card = slide.firstElementChild as HTMLElement | null;
            if (!card) return;
            const r = slide.getBoundingClientRect();
            // Undo any transform we applied last frame: measure from the
            // slide's layout box, not its shifted visual box.
            const slideCenter = r.left + r.width / 2;
            const signed = (slideCenter - center) / (SLIDE_W + GAP);
            const d = Math.abs(signed);
            const shift = -Math.sign(signed) * arcShift(d);
            card.style.transform = `translateX(${shift.toFixed(2)}px) scale(${arcScale(d).toFixed(4)})`;
            // Stacked-deck feel: the centre card floats highest (big soft
            // shadow, top of the stack); shadows fade and cards slide UNDER
            // their neighbours toward the edges.
            const t = Math.min(d / 2, 1);
            const y = 24 - 16 * t;
            const blur = 48 - 30 * t;
            const alpha = 0.25 - 0.18 * t;
            card.style.boxShadow = `0 ${y.toFixed(1)}px ${blur.toFixed(1)}px -12px rgba(0,0,0,${alpha.toFixed(3)})`;
            slide.style.zIndex = String(Math.round(100 - d * 10));
        });
    }, [emblaApi]);

    useEffect(() => {
        if (!emblaApi) return;
        const onSelect = () => {
            setSelected(emblaApi.selectedScrollSnap());
            // A fresh centre card always starts playing, never pre-paused.
            setPaused(false);
        };
        onSelect();
        applyArc();
        emblaApi.on('select', onSelect);
        emblaApi.on('scroll', applyArc);
        emblaApi.on('reInit', applyArc);
        return () => {
            emblaApi.off('select', onSelect);
            emblaApi.off('scroll', applyArc);
            emblaApi.off('reInit', applyArc);
        };
    }, [emblaApi, applyArc]);

    // Side-card play button: unlock sound (we have a user gesture) and glide
    // the card to the centre - `select` fires on the way and mounts its video.
    const handlePlay = (index: number) => {
        setSoundOn(true);
        setPaused(false);
        emblaApi?.scrollTo(index);
    };

    // Toggle the currently mounted video between play and pause (same button).
    // An explicit play press is a user gesture - unlock sound with it.
    const toggleVideo = () => {
        const v = videoRef.current;
        if (!v) return;
        if (v.paused) {
            setSoundOn(true);
            v.muted = false;
            void v.play();
        } else {
            v.pause();
        }
    };

    // One dot per real card; clicking a dot centres (and thereby plays) it.
    const realIndex = ((selected % REAL) + REAL) % REAL;
    const goToDot = (dot: number) => {
        if (!emblaApi) return;
        const base = selected - realIndex;
        emblaApi.scrollTo(base + dot);
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
                        className='w-full mx-auto overflow-hidden cursor-grab select-none active:cursor-grabbing'
                        style={{ maxWidth: VIEWPORT_W }}
                        ref={emblaRef}>
                        <div
                            className='flex items-center'
                            // Extra vertical room: the embla viewport is
                            // overflow-hidden, and without it the centre
                            // card's drop shadow would clip at the bottom.
                            style={{ height: H_MAX + 88, gap: GAP }}>
                            {SLIDES.map((card, i) => {
                                const hasMedia = Boolean(card.image);
                                // The centre (selected) card is always the one
                                // playing - side cards only show their poster.
                                const isPlaying =
                                    selected === i && Boolean(card.video);
                                const title = dict.cards[card.key];
                                return (
                                    <div
                                        key={`${card.key}-${i}`}
                                        className='relative shrink-0'
                                        style={{ width: SLIDE_W }}>
                                        <div
                                            className='relative w-full overflow-hidden rounded-it-lg bg-it-border will-change-transform'
                                            style={{ height: H_MAX }}>
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
                                                        if (el)
                                                            videoRef.current =
                                                                el;
                                                    }}
                                                    src={card.video as string}
                                                    poster={
                                                        card.image ?? undefined
                                                    }
                                                    autoPlay
                                                    muted={!soundOn}
                                                    playsInline
                                                    // The reel advances when the
                                                    // video finishes (no loop) -
                                                    // the next centred card then
                                                    // auto-plays.
                                                    onEnded={() =>
                                                        emblaApi?.scrollNext()
                                                    }
                                                    // If the browser still blocks
                                                    // (un)muted autoplay, retry
                                                    // muted so the reel never
                                                    // freezes on a poster.
                                                    onLoadedData={e => {
                                                        const v =
                                                            e.currentTarget;
                                                        if (!v.paused) return;
                                                        v.play().catch(() => {
                                                            v.muted = true;
                                                            v.play().catch(
                                                                () => {}
                                                            );
                                                        });
                                                    }}
                                                    // Only the CURRENT video drives the paused state -
                                                    // a departing video fires pause on unmount and
                                                    // would flip the fresh card's icon.
                                                    onPlay={e => {
                                                        if (
                                                            e.currentTarget ===
                                                            videoRef.current
                                                        )
                                                            setPaused(false);
                                                    }}
                                                    onPause={e => {
                                                        if (
                                                            e.currentTarget ===
                                                            videoRef.current
                                                        )
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
                                                            : () =>
                                                                  handlePlay(i)
                                                    }
                                                    // Keep the press away from Embla's drag watcher -
                                                    // a micro-movement during the press otherwise
                                                    // registers as a drag and swallows the click.
                                                    onPointerDown={e =>
                                                        e.stopPropagation()
                                                    }
                                                    whileTap={{ scale: 0.9 }}
                                                    transition={springPop}
                                                    className='absolute top-4 right-4 flex size-9 items-center justify-center rounded-full bg-it-white/30 backdrop-blur-sm cursor-pointer border-none transition-colors hover:bg-it-white/50'>
                                                    <AnimatePresence
                                                        mode='wait'
                                                        initial={false}>
                                                        <motion.span
                                                            key={
                                                                isPlaying &&
                                                                !paused
                                                                    ? 'pause'
                                                                    : 'play'
                                                            }
                                                            initial={{
                                                                scale: 0,
                                                            }}
                                                            animate={{
                                                                scale: 1,
                                                            }}
                                                            exit={{ scale: 0 }}
                                                            transition={
                                                                springPop
                                                            }
                                                            className='inline-flex'>
                                                            {isPlaying &&
                                                            !paused ? (
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
                                                            hasMedia
                                                                ? 'text-it-white'
                                                                : 'text-it-heading',
                                                        ].join(' ')}>
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

                    {/* Pagination - one dot per card */}
                    <div className='flex items-center gap-2'>
                        {cards.map((card, dot) => (
                            <motion.button
                                key={card.key}
                                type='button'
                                aria-label={`Go to ${dict.cards[card.key]}`}
                                onClick={() => goToDot(dot)}
                                whileTap={{ scale: 0.9 }}
                                transition={springPop}
                                className={[
                                    'h-1.5 w-8 rounded-full transition-colors duration-300 cursor-pointer border-none',
                                    dot === realIndex
                                        ? 'bg-it-ink-muted'
                                        : 'bg-it-border',
                                ].join(' ')}
                            />
                        ))}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

