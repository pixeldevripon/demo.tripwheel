'use client';

import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';


const EASE = [0.21, 0.47, 0.32, 0.98] as const;

/**
 * Hero (Clarasight ref): deep teal-blue gradient dissolving into the tinted
 * canvas, faint white grid, centred headline + twin pill CTAs, trust line at
 * the fold. Entrance is a staggered mount animation - the hero is above the
 * fold, so a scroll trigger could never fire.
 */
export function MarketingHero() {
    const reduceMotion = useReducedMotion();

    const enter = (delay: number) => ({
        initial: reduceMotion ? false : { opacity: 0, y: 24 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.8, delay, ease: EASE },
    });

    return (
        <section id='home' className='mk-hero-bg relative overflow-hidden'>
            <div
                className='mk-hero-grid pointer-events-none absolute inset-0'
                aria-hidden='true'
            />

            <div className='relative mx-auto flex max-w-3xl flex-col items-center px-6 pt-mk-half pb-mk-hero text-center md:pt-mk-section'>
                <motion.h1
                    {...enter(0.05)}
                    className='text-mk-title font-medium text-white md:text-mk-hero'>
                    The growth platform for
                    <br className='hidden sm:block' /> modern travel agencies
                </motion.h1>

                <motion.p
                    {...enter(0.18)}
                    className='mt-6 max-w-xl text-sm leading-relaxed text-mk-hero-copy md:text-base'>
                    Purpose-built operating system for travel agencies and tour
                    operators to sell smarter, automate operations, and turn
                    every itinerary into revenue.
                </motion.p>

                <motion.div
                    {...enter(0.3)}
                    className='mt-8 flex flex-wrap items-center justify-center gap-3'>
                    <Link
                        href='/login'
                        className='inline-flex h-11 items-center rounded-full bg-mk-paper px-6 text-sm font-medium text-mk-ink transition-transform hover:scale-[1.03] active:scale-[0.98]'>
                        Start free
                    </Link>
                    <a
                        href='#pricing'
                        className='inline-flex h-11 items-center gap-2 rounded-full border border-mk-ghost-line bg-mk-ghost px-6 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-mk-ghost-hover'>
                        See how it works
                        <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            className='size-4'
                        />
                    </a>
                </motion.div>
            </div>

            <motion.p
                {...enter(0.55)}
                className='relative pb-8 text-center text-xs text-mk-body'>
                Trusted by modern travel teams running complex tour operations
            </motion.p>
        </section>
    );
}
