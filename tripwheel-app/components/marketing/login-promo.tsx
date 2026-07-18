'use client';

import {
    ArrowLeft01Icon,
    ArrowRight01Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const SLIDES = [
    {
        eyebrow: 'Available on Growth & Scale',
        title: 'TripWheel Automations are here',
        copy: 'Confirmations, itineraries, payment reminders, and supplier payouts that run themselves - built natively into TripWheel, so your team ships trips instead of spreadsheets.',
        cta: { label: 'Learn more', href: '/#pricing' },
    },
    {
        eyebrow: 'New in TripWheel',
        title: 'Channel & OTA sync, unified',
        copy: 'Sell across every channel without double bookings. TripWheel keeps availability, rates, and reservations in lockstep - one calendar, every marketplace.',
        cta: { label: 'See pricing', href: '/#pricing' },
    },
    {
        eyebrow: 'Loved by operators',
        title: 'From enquiry to payout, one flow',
        copy: 'Quotes become bookings, bookings become itineraries, itineraries become revenue - every step tracked, every traveler informed, without leaving TripWheel.',
        cta: { label: 'Talk to sales', href: '/#contact' },
    },
];

const AUTO_ADVANCE_MS = 6000;

/**
 * Panel mode switch. `true` fills the whole left panel with the promo video
 * and hides the slider/collage content; flip to `false` to bring back the
 * original content layout (slides, arrows, dots, floating booking cards).
 */
const SHOW_VIDEO_ONLY = true;

const slideVariants = {
    enter: (direction: number) => ({ x: direction > 0 ? 48 : -48, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (direction: number) => ({ x: direction > 0 ? -48 : 48, opacity: 0 }),
};

/**
 * Left promo panel of the auth screens, in the homepage's own language: the
 * hero gradient, floating booking-ops
 * cards up top, an auto-advancing content slider bottom-left (arrows + dots,
 * directional slide animation, paused for reduced-motion users), and a
 * compact product video card pinned to the bottom-right.
 */
export function LoginPromo() {
    const reduceMotion = useReducedMotion();
    const [[index, direction], setSlide] = useState([0, 1]);

    const step = (delta: number) =>
        setSlide(([current]) => [
            (current + delta + SLIDES.length) % SLIDES.length,
            delta,
        ]);

    const goTo = (next: number) =>
        setSlide(([current]) => [next, next > current ? 1 : -1]);

    // Auto-advance; any manual step/goTo re-arms the timer via deps.
    useEffect(() => {
        if (reduceMotion) return;
        const timer = setInterval(() => step(1), AUTO_ADVANCE_MS);
        return () => clearInterval(timer);
    }, [index, reduceMotion]);

    const slide = SLIDES[index];

    if (SHOW_VIDEO_ONLY) {
        return <VideoOnlyPanel />;
    }

    return (
        <div className='mk-hero-bg relative flex h-full flex-col overflow-hidden rounded-3xl px-8 py-[clamp(1.5rem,3vh,3rem)] md:px-12'>
            <BookingCollage />

            <div className='absolute top-1/2 right-8 z-10 flex -translate-y-1/2 gap-2 md:right-12'>
                <button
                    type='button'
                    aria-label='Previous slide'
                    onClick={() => step(-1)}
                    className='inline-flex size-10 items-center justify-center rounded-full border border-mk-ghost-line bg-mk-ghost text-white backdrop-blur-sm transition-all hover:bg-mk-ghost-hover hover:scale-105 active:scale-95'>
                    <HugeiconsIcon icon={ArrowLeft01Icon} className='size-4' />
                </button>
                <button
                    type='button'
                    aria-label='Next slide'
                    onClick={() => step(1)}
                    className='inline-flex size-10 items-center justify-center rounded-full border border-mk-ghost-line bg-mk-ghost text-white backdrop-blur-sm transition-all hover:bg-mk-ghost-hover hover:scale-105 active:scale-95'>
                    <HugeiconsIcon icon={ArrowRight01Icon} className='size-4' />
                </button>
            </div>

            <div className='relative mt-[clamp(2.5rem,7vh,8rem)] flex flex-1 flex-col'>
                <div className='overflow-hidden'>
                    <AnimatePresence
                        mode='wait'
                        initial={false}
                        custom={direction}>
                        <motion.div
                            key={index}
                            custom={direction}
                            variants={reduceMotion ? undefined : slideVariants}
                            initial='enter'
                            animate='center'
                            exit='exit'
                            transition={{
                                duration: 0.35,
                                ease: [0.25, 1, 0.5, 1],
                            }}>
                            <p className='text-sm text-mk-hero-copy md:text-base'>
                                {slide.eyebrow}
                            </p>
                            <h2 className='mt-3 max-w-xl text-mk-title font-medium text-white md:text-mk-display'>
                                {slide.title}
                            </h2>
                            <p className='mt-4 max-w-lg text-sm leading-relaxed text-mk-hero-copy md:text-base'>
                                {slide.copy}
                            </p>
                            <Link
                                href={slide.cta.href}
                                className='mt-8 inline-flex h-10 items-center rounded-md bg-mk-paper px-6 text-sm font-medium text-mk-ink transition-transform hover:scale-[1.03] active:scale-[0.98]'>
                                {slide.cta.label}
                            </Link>
                        </motion.div>
                    </AnimatePresence>
                </div>

                <div className='mt-20! hidden justify-end 2xl:flex'>
                 <PromoVideo /> 
                </div>

                <div className='flex items-center pt-10'>
                    <div className='flex items-center gap-2'>
                        {SLIDES.map((s, i) => (
                            <button
                                key={s.title}
                                type='button'
                                aria-label={`Go to slide ${i + 1}`}
                                aria-current={i === index}
                                onClick={() => goTo(i)}
                                className={`h-1.5 rounded-full transition-all duration-slow ${
                                    i === index
                                        ? 'w-6 bg-mk-ink'
                                        : 'w-1.5 bg-mk-ink/25 hover:bg-mk-ink/40'
                                }`}
                            />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Full-bleed variant: the promo video covers the entire left panel, no
 * content on top. Keeps the hero gradient behind it as a fallback while the
 * video loads (or if the file is missing). Enabled via SHOW_VIDEO_ONLY.
 */
function VideoOnlyPanel() {
    return (
        <div className='mk-hero-bg relative h-full overflow-hidden rounded-3xl'>
            <video
                src='/media/video.mp4'
                autoPlay
                muted
                loop
                playsInline
                preload='metadata'
                aria-hidden='true'
                className='absolute inset-0 size-full object-cover'
            />
   {/*          <div
                className='pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/10'
                aria-hidden='true'
            /> */}
        </div>
    );
}

/**
 * Compact product/stock video card pinned to the bottom-right of the panel,
 * clear of the slider text and the controls row. Drop an MP4 at
 * public/media/promo.mp4 (short, loopable, plays muted). Until that file
 * exists the card hides itself via onError.
 */
function PromoVideo() {
    const [available, setAvailable] = useState(true);

    if (!available) return null;

    return (
        <div className='absolute right-0 bottom-16 hidden aspect-video w-84 overflow-hidden rounded-xl border border-mk-ghost-line shadow-mk-float lg:block xl:w-84'>
            <video
                src='/media/video.mp4'
                autoPlay
                muted
                loop
                playsInline
                preload='metadata'
                aria-hidden='true'
                onError={() => setAvailable(false)}
                className='absolute inset-0 size-full object-cover'
            />
        </div>
    );
}

/**
 * Floating booking-ops cards over the gradient - the same family as the
 * pricing collage on the homepage. Each card drifts gently unless the user
 * prefers reduced motion.
 */
function BookingCollage() {
    const reduceMotion = useReducedMotion();

    const float = (delay: number) =>
        reduceMotion
            ? {}
            : {
                  animate: { y: [0, -8, 0] },
                  transition: {
                      duration: 5.5,
                      delay,
                      repeat: Infinity,
                      ease: 'easeInOut' as const,
                  },
              };

    return (
        <div
            className='relative mt-[clamp(0.5rem,2vh,3rem)] h-[clamp(11rem,26vh,18rem)] shrink-0 select-none'
            aria-hidden='true'>
            <motion.div
                {...float(0)}
                className='absolute top-8 left-0 w-56 -rotate-3 rounded-lg border border-mk-line bg-mk-paper p-4 shadow-mk-float'>
                <p className='font-mono text-2xs tracking-caps text-mk-faint uppercase'>
                    Booking BK-2481
                </p>
                <p className='mt-2 text-sm font-medium text-mk-ink'>
                    Santorini Sunset Cruise
                </p>
                <div className='mt-3 flex items-center justify-between border-t border-mk-line pt-3'>
                    <span className='text-xs text-mk-body'>2 travelers</span>
                    <span className='rounded-full bg-mk-accent-soft px-2 py-0.5 text-2xs font-semibold text-mk-accent-soft-fg'>
                        Confirmed
                    </span>
                </div>
            </motion.div>

            <motion.div
                {...float(1.2)}
                className='absolute top-0 left-48 z-10 w-64 rotate-2 rounded-lg border border-mk-line bg-mk-paper p-4 shadow-mk-float md:left-56'>
                <div className='flex items-center justify-between'>
                    <p className='font-mono text-2xs tracking-caps text-mk-faint uppercase'>
                        Auto-payouts
                    </p>
                    <span className='rounded-full bg-mk-accent-soft px-2 py-0.5 text-2xs font-semibold text-mk-accent-soft-fg'>
                        Enabled
                    </span>
                </div>
                <div className='mt-3 flex flex-col gap-2'>
                    <div className='flex justify-between text-xs'>
                        <span className='text-mk-body'>Gross bookings</span>
                        <span className='font-mono text-mk-ink'>$48,290</span>
                    </div>
                    <div className='flex justify-between text-xs'>
                        <span className='text-mk-body'>Supplier payouts</span>
                        <span className='font-mono text-mk-ink'>$31,760</span>
                    </div>
                    <div className='flex justify-between border-t border-mk-line pt-2 text-xs'>
                        <span className='text-mk-body'>Net revenue</span>
                        <span className='font-mono font-semibold text-mk-ink'>
                            $16,530
                        </span>
                    </div>
                </div>
            </motion.div>

            <motion.div
                {...float(2.4)}
                className='absolute bottom-2 left-24 w-52 rotate-1 rounded-lg border border-mk-line bg-mk-paper p-4 shadow-mk-float md:left-32'>
                <p className='font-mono text-2xs tracking-caps text-mk-faint uppercase'>
                    Workflow
                </p>
                <p className='mt-2 text-xs text-mk-body'>
                    Send itinerary 48h before departure
                </p>
                <span className='mt-3 inline-block rounded-full bg-mk-accent-soft px-2 py-0.5 text-2xs font-semibold text-mk-accent-soft-fg'>
                    Active - 142 sent overnight
                </span>
            </motion.div>
        </div>
    );
}

