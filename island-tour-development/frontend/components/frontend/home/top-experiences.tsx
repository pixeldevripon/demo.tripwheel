'use client';

import { crossFade, iconSwap, springPop } from '@/lib/motion';
import useEmblaCarousel from 'embla-carousel-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Reveal } from '../reveal';

type CardKey =
    | 'sunsetCruise'
    | 'catamaranTrip'
    | 'buggyTour'
    | 'snorkeling'
    | 'dolphin';

/**
 * A slide. `href` is null for the bundled fallback cards (they are decorative
 * placeholders with nowhere real to point); curated cards always carry one.
 */
type Card = {
    key: string;
    title: string;
    image: string | null;
    video: string | null;
    href: string | null;
};

/** An admin-curated card, already resolved and localized by the page. */
export type ExperienceCard = {
    id: string;
    title: string;
    image: string | null;
    videoUrl: string | null;
    href: string;
};

type ExperiencesDict = { title: string; cards: Record<CardKey, string> };

/**
 * Below this, the curated set is not worth showing: the reel loops three copies
 * of the card list, and one or two real cards would read as an obvious repeat.
 * Fewer than this falls back to the bundled cards - the same "never blank"
 * contract the rest of the homepage content follows.
 */
const MIN_CURATED_CARDS = 3;

/** How far a pointer may travel between press and release and still count as a
 *  click rather than a carousel drag. */
const DRAG_SLOP_PX = 8;

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

/**
 * Bundled fallback deck, used until an admin curates at least
 * MIN_CURATED_CARDS experiences (and if the backend is unreachable). Labels come
 * from the i18n dictionary; these cards have no href because they name generic
 * activities rather than a real category or hub page.
 */
const RAW_CARDS: {
    key: CardKey;
    image: string | null;
    video: string | null;
}[] = [
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

// Size arc (design v2 reels rail) - the centre card renders at full size,
// neighbours at ~0.85x, outer cards at ~0.7x. Cards scale PROPORTIONALLY
// (width + height together) via transform, and a translate correction pulls
// the shrunken cards inward so the visual gaps stay even instead of growing
// toward the edges.
//
// Dimensions follow the mockup's two breakpoints: 250-wide 9:16 cards on
// desktop, the 172-wide / 330px rail on mobile. The LAYOUT sizes live in
// Tailwind classes (w/h/gap with max-md: overrides) so the first paint is
// correct at every viewport with no hydration flash; these constants exist
// ONLY for the arc math, which runs post-mount, and MUST match the classes.
const DESKTOP_DIMS = { slideW: 250, gap: 18 };
const MOBILE_DIMS = { slideW: 172, gap: 12 };
/** Scale by distance-from-centre in slide units: 1 -> 0.85 -> 0.7, clamped. */
const SCALE_STEP = 0.15;
const SCALE_MIN = 0.7;
const arcScale = (d: number) => Math.max(1 - SCALE_STEP * d, SCALE_MIN);
/**
 * How far the ANCHOR card (the one nearest the centre) shifts toward the
 * centre: the integral of the accumulated scale insets, W * ∫(1-scale).
 * For scale(t)=1-0.15t (floored at 0.7 from t=2): 0.075d² up to d=2, then
 * linear at the 0.3 floor. Only the anchor uses this closed form (it decays
 * to 0 as the card centres); every other card is CHAINED edge-to-edge from
 * it in applyArc, which keeps the visual gap exact on every frame - the
 * closed form preserved gaps only at whole-slide distances, and at
 * fractional mid-scroll positions the kink at d=2 squeezed neighbouring
 * cards into each other.
 */
const arcShift = (d: number, slideW: number) =>
    slideW * (d <= 2 ? 0.075 * d * d : 0.3 * (d - 2) + 0.3);

export function TopExperiences({
    dict,
    experiences,
}: {
    dict: ExperiencesDict;
    /** Curated cards, resolved + localized by the page. */
    experiences?: ExperienceCard[];
}) {
    // Curated content wins; too few (or none) falls back to the bundled deck so
    // the section is never empty and never a one-card "carousel".
    const cards = useMemo<Card[]>(() => {
        if (experiences && experiences.length >= MIN_CURATED_CARDS) {
            return experiences.map(e => ({
                key: e.id,
                title: e.title,
                // cld() only rewrites Cloudinary URLs (it keys off `/upload/`),
                // so non-Cloudinary admin images pass through untouched.
                image: e.image && cld(e.image, CLD_IMAGE_TX),
                video: e.videoUrl && cld(e.videoUrl, CLD_VIDEO_TX),
                href: e.href,
            }));
        }
        return RAW_CARDS.map(card => ({
            key: card.key,
            title: dict.cards[card.key],
            image: card.image && cld(card.image, CLD_IMAGE_TX),
            video: card.video && cld(card.video, CLD_VIDEO_TX),
            href: null,
        }));
    }, [experiences, dict]);

    const REAL = cards.length;
    // Repeat the set so the track overflows the viewport - required for a seamless infinite loop
    const SLIDES = useMemo(() => [...cards, ...cards, ...cards], [cards]);
    // Centre the middle card of the middle set.
    const START = REAL + Math.floor(REAL / 2);

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
    // Mockup mobile breakpoint (<768px) shrinks the whole arc. Layout sizes
    // are pure CSS (max-md: classes) - this state only feeds the arc MATH,
    // which runs post-mount, so no first-paint flash. Embla's built-in resize
    // watcher re-measures when the CSS dimensions swap.
    const [isMobile, setIsMobile] = useState(false);
    useEffect(() => {
        const mq = window.matchMedia('(max-width: 767px)');
        const update = () => setIsMobile(mq.matches);
        update();
        mq.addEventListener('change', update);
        return () => mq.removeEventListener('change', update);
    }, []);
    const { slideW, gap } = isMobile ? MOBILE_DIMS : DESKTOP_DIMS;
    // Centre-card playback progress (0..1) for the mockup's thin bottom bar.
    const [progress, setProgress] = useState(0);
    // Automatic playback (page load, ended-advance) must start muted or the
    // browser blocks it; the first explicit play click unlocks sound.
    const [soundOn, setSoundOn] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    // Where the pointer went down on a card link, so a swipe across the reel is
    // not delivered as a click. Embla 8 exposes no `clickAllowed()`, so the
    // distance test lives here rather than leaning on carousel internals.
    const pressOrigin = useRef<{ x: number; y: number } | null>(null);

    // Size arc: each card scales (and shifts inward) by its live distance from
    // the carousel centre, re-applied on every scroll frame so the arc morphs
    // continuously while dragging/sliding.
    const applyArc = useCallback(() => {
        if (!emblaApi) return;
        const rect = emblaApi.rootNode().getBoundingClientRect();
        const center = rect.left + rect.width / 2;
        const pitch = slideW + gap;
        // Measure every slide's layout box first (our transform lives on the
        // inner card, so the slide rect is never polluted by our own writes).
        const measured = emblaApi.slideNodes().flatMap(slide => {
            const card = slide.firstElementChild as HTMLElement | null;
            if (!card) return [];
            const r = slide.getBoundingClientRect();
            const slideCenter = r.left + r.width / 2;
            const signed = (slideCenter - center) / pitch;
            return [{ slide, card, slideCenter, signed, d: Math.abs(signed) }];
        });
        // Embla's loop teleports change the VISUAL order - chain by position,
        // not DOM order.
        measured.sort((a, b) => a.slideCenter - b.slideCenter);
        if (measured.length === 0) return;

        // Relative chain: exact edge-to-edge spacing, zero at the first card,
        // so the visual gap is EXACTLY `gap` on every animation frame -
        // fractional positions included.
        const half = (m: { d: number }) => (slideW * arcScale(m.d)) / 2;
        const rel: number[] = new Array(measured.length);
        rel[0] = 0;
        for (let i = 1; i < measured.length; i++)
            rel[i] =
                rel[i - 1] + half(measured[i - 1]) + gap + half(measured[i]);

        // The chain fixes every RELATIVE position; one scalar offset places
        // the whole assembly. Deriving that offset from a single
        // nearest-to-centre anchor pops the assembly slideW*0.0375 px
        // sideways at every handoff (the closed form and the chain disagree
        // at the d=0.5 tie), so blend the two candidate anchors - the cards
        // straddling the centre - by their distance to it. At rest the blend
        // collapses to the centred card's closed form (shift 0), and at a
        // handoff the outgoing card's weight is exactly 0, so the offset is
        // continuous through every frame of a transition.
        const closedOffset = (i: number) => {
            const m = measured[i];
            return (
                m.slideCenter -
                Math.sign(m.signed) * arcShift(m.d, slideW) -
                rel[i]
            );
        };
        let left = -1;
        for (let i = 0; i < measured.length; i++)
            if (measured[i].signed <= 0) left = i;
        const right = left + 1;
        let offset: number;
        if (left < 0) offset = closedOffset(0);
        else if (right >= measured.length) offset = closedOffset(left);
        else {
            const dL = measured[left].d;
            const dR = measured[right].d;
            const wL = dR / (dL + dR || 1);
            offset = wL * closedOffset(left) + (1 - wL) * closedOffset(right);
        }

        measured.forEach((m, i) => {
            const shift = rel[i] + offset - m.slideCenter;
            m.card.style.transform = `translateX(${shift.toFixed(2)}px) scale(${arcScale(m.d).toFixed(4)})`;
            // Stacked-deck feel: the centre card floats highest (big soft
            // shadow, top of the stack); shadows fade toward the edges.
            const t = Math.min(m.d / 2, 1);
            const y = 24 - 16 * t;
            const blur = 48 - 30 * t;
            const alpha = 0.25 - 0.18 * t;
            m.card.style.boxShadow = `0 ${y.toFixed(1)}px ${blur.toFixed(1)}px -12px rgba(0,0,0,${alpha.toFixed(3)})`;
            m.slide.style.zIndex = String(Math.round(100 - m.d * 10));
        });
    }, [emblaApi, slideW, gap]);

    useEffect(() => {
        if (!emblaApi) return;
        const onSelect = () => {
            setSelected(emblaApi.selectedScrollSnap());
            // A fresh centre card always starts playing, never pre-paused.
            setPaused(false);
            setProgress(0);
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

    /**
     * A card link behaves like the rest of the reel: a card that is not centred
     * pulls into the centre instead of navigating (the same affordance the play
     * button gives), and only the centred card follows its href. A press that
     * travelled more than the drag slop was a swipe, so it never navigates.
     */
    const handleCardClick = (
        e: React.MouseEvent<HTMLAnchorElement>,
        index: number
    ) => {
        const origin = pressOrigin.current;
        pressOrigin.current = null;
        const dragged =
            origin &&
            Math.hypot(e.clientX - origin.x, e.clientY - origin.y) >
                DRAG_SLOP_PX;

        if (dragged || selected !== index) {
            e.preventDefault();
            if (!dragged) emblaApi?.scrollTo(index);
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
                <Reveal className='flex flex-col items-center gap-8'>
                    <h2 className='m-0 text-[clamp(22px,2.6vw,30px)] leading-[1.1] tracking-[-0.015em] text-it-ink font-medium text-center'>
                        {dict.title}
                    </h2>

                    {/* Carousel - drag to swipe (Embla handles pointer + touch) */}
                    {/* Viewport cap = 5 packed cards (1x + 2×0.85x + 2×0.7x +
                        4 gaps) so loop slides never crop at the edges. */}
                    <div
                        className='w-full mx-auto overflow-hidden cursor-grab select-none active:cursor-grabbing max-w-[1097px] max-md:max-w-[753px]'
                        ref={emblaRef}>
                        {/* Extra vertical room: the embla viewport is
                            overflow-hidden, and without it the centre card's
                            drop shadow would clip at the bottom. */}
                        <div className='flex items-center h-[528px] gap-[18px] max-md:h-[330px] max-md:gap-3'>
                            {SLIDES.map((card, i) => {
                                const hasMedia = Boolean(card.image);
                                // The centre (selected) card is always the one
                                // playing - side cards only show their poster.
                                const isPlaying =
                                    selected === i && Boolean(card.video);
                                const title = card.title;
                                return (
                                    <div
                                        key={`${card.key}-${i}`}
                                        className='relative shrink-0 w-[250px] max-md:w-[172px]'>
                                        <div className='relative w-full h-[440px] max-md:h-[306px] overflow-hidden rounded-it-xl bg-it-bg will-change-transform'>
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
                                                    // Drives the mockup's thin
                                                    // bottom progress bar.
                                                    onTimeUpdate={e => {
                                                        const v =
                                                            e.currentTarget;
                                                        if (
                                                            v ===
                                                                videoRef.current &&
                                                            v.duration
                                                        )
                                                            setProgress(
                                                                v.currentTime /
                                                                    v.duration
                                                            );
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

                                            {/* Design v2 card scrim: bottom
                                                wash so the caption stays
                                                legible over photo and video -
                                                only with media; the empty
                                                paper fallback stays flat. */}
                                            {hasMedia && (
                                                <div className='pointer-events-none absolute inset-0 bg-[image:var(--it-scrim-card)]' />
                                            )}

                                            {/* Thin playback progress line at
                                                the card's foot (mockup .pb) -
                                                centre card only. */}
                                            {isPlaying && (
                                                <div className='pointer-events-none absolute inset-x-0 bottom-0 z-10 h-[3px] bg-it-white/25'>
                                                    {/* timeupdate ticks ~4x/s; the linear width
                                                        transition interpolates between ticks so
                                                        the bar glides instead of stepping. */}
                                                    <div
                                                        className='h-full bg-it-primary transition-[width] duration-300 ease-linear'
                                                        style={{
                                                            width: `${progress * 100}%`,
                                                        }}
                                                    />
                                                </div>
                                            )}

                                            {/* Stretched link covering the card. A sibling
                                                overlay rather than a wrapper: the play control
                                                is a <button>, and a button nested inside an
                                                anchor is invalid HTML. Sits above the artwork
                                                and caption (z-10) but below that button (z-20),
                                                so each press hits exactly one control. */}
                                            {card.href && (
                                                <Link
                                                    href={card.href}
                                                    aria-label={title}
                                                    draggable={false}
                                                    onPointerDown={e => {
                                                        pressOrigin.current = {
                                                            x: e.clientX,
                                                            y: e.clientY,
                                                        };
                                                    }}
                                                    onClick={e =>
                                                        handleCardClick(e, i)
                                                    }
                                                    className='absolute inset-0 z-10'
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
                                                    className='absolute top-3 right-3 z-20 flex size-[30px] items-center justify-center rounded-full bg-it-white/35 border border-it-white/55 backdrop-blur-[6px] cursor-pointer transition-colors hover:bg-it-white/50'>
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
                                                                opacity: 0,
                                                            }}
                                                            animate={{
                                                                opacity: 1,
                                                            }}
                                                            exit={{
                                                                opacity: 0,
                                                            }}
                                                            transition={
                                                                iconSwap
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
                                                <span className='absolute top-3 right-3 z-20 flex size-[30px] items-center justify-center rounded-full bg-it-white/40 border border-it-white/55'>
                                                    <Play className='size-3 fill-it-ink-muted text-it-ink-muted' />
                                                </span>
                                            )}

                                            {/* Category caption on EVERY card, the playing centre
                                                one included (founder, 2026-08-04): the reel a
                                                visitor is watching must be the one that is named.
                                                The card scrim + text-shadow keep it legible over
                                                the running video. */}
                                            <p
                                                className={[
                                                    'absolute bottom-[13px] inset-x-[15px] m-0 text-left font-bold text-[13.5px] leading-[1.2] tracking-[-0.005em]',
                                                    hasMedia
                                                        ? 'text-it-white [text-shadow:0_1px_10px_rgba(0,0,0,0.6),0_1px_2px_rgba(0,0,0,0.45)]'
                                                        : 'text-it-heading',
                                                ].join(' ')}>
                                                {title}
                                            </p>
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
                                aria-label={`Go to ${card.title}`}
                                onClick={() => goToDot(dot)}
                                whileTap={{ scale: 0.9 }}
                                transition={springPop}
                                className={[
                                    'h-1 w-[26px] rounded-[2px] transition-colors duration-300 cursor-pointer border-none',
                                    dot === realIndex
                                        ? 'bg-it-primary'
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

