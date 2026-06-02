'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Reveal } from './reveal';

type CategoryKey = 'buggy' | 'snorkel' | 'catamaran';

type CategoryCard = {
    key: CategoryKey;
    image: string;
    position: string; // fan offset + rotation (mobile base, lg override)
    z: number;
};

type EditorialDict = {
    titleLine1: string;
    titleLine2: string;
    body: string;
    cta: string;
    categories: Record<CategoryKey, string>;
};

const categories: CategoryCard[] = [
    {
        key: 'buggy',
        image: '/images/home-page/categories/buggy-tours.jpg',
        position: 'left-[calc(50%-180px)] top-3 -rotate-[8deg] lg:left-0',
        z: 10,
    },
    {
        key: 'snorkel',
        image: '/images/home-page/categories/snorkel-trips.jpg',
        position: 'left-[calc(50%-100px)] top-0 lg:left-35',
        z: 20,
    },
    {
        key: 'catamaran',
        image: '/images/home-page/categories/catamaran-trips.jpg',
        position: 'left-[calc(50%-20px)] top-3 rotate-[8deg] lg:left-56.5',
        z: 10,
    },
];

export function EditorialBanner({ dict }: { dict: EditorialDict }) {
    // Index of the card lifted to the front — defaults to the middle card
    const [topIndex, setTopIndex] = useState(2);

    return (
        <section className='it-section bg-it-white overflow-x-clip'>
            <div className='it-container'>
                <Reveal className='relative lg:h-[452px]'>
                    {/* Backdrop — orange washing to white: downward on mobile, rightward on desktop. */}
                    <div className='absolute inset-0 overflow-hidden rounded-[12px] bg-it-white [background-image:var(--it-editorial-gradient-v)] lg:rounded-3xl lg:[background-image:var(--it-editorial-gradient)]' />

                    {/* Mobile/tablet: stacked column · Desktop: full-height positioning context for the absolute copy + fan */}
                    <div className='relative flex flex-col gap-8 px-6 py-10 sm:px-10 sm:py-12 lg:block lg:h-full lg:p-0'>
                        {/* Editorial copy */}
                        <div className='flex flex-col gap-6 sm:gap-8 lg:absolute lg:inset-y-16 lg:left-16 lg:w-115 lg:justify-between lg:gap-0'>
                            <div className='flex flex-col gap-4'>
                                <h2 className='m-0 flex flex-col gap-2 font-medium text-[32px] leading-[1.2] tracking-[-0.012em] text-it-white sm:text-[40px]'>
                                    <span>{dict.titleLine1}</span>
                                    <span>{dict.titleLine2}</span>
                                </h2>
                                <p className='m-0 max-w-[441px] text-[14px] sm:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white/80'>
                                    {dict.body}
                                </p>
                            </div>

                            <motion.button
                                type='button'
                                className='flex w-full items-center justify-center gap-2.5 rounded-it-full bg-it-white px-12 py-[19px] cursor-pointer border-none sm:w-auto lg:w-full'
                                initial='rest'
                                animate='rest'
                                whileHover='hover'
                                whileTap='tap'
                                variants={{ rest: { scale: 1 }, tap: { scale: 0.97 } }}
                                transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                            >
                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-primary'>
                                    {dict.cta}
                                </span>
                                <motion.span
                                    className='inline-flex'
                                    variants={{ rest: { x: 0 }, hover: { x: 4 }, tap: { x: 8 } }}
                                    transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                >
                                    <ArrowRight className='size-6 text-it-primary' strokeWidth={1.5} />
                                </motion.span>
                            </motion.button>
                        </div>

                        {/* Category cards — fanned deck (2nd row on mobile, right side on desktop). Click brings a card to the front. */}
                        <div className='relative -mx-6 h-78 sm:-mx-10 lg:absolute lg:right-12 lg:top-1/2 lg:mx-0 lg:h-100 lg:w-130 lg:-translate-y-1/2'>
                            {categories.map((card, i) => {
                                const isTop = i === topIndex;
                                const title = dict.categories[card.key];
                                return (
                                    <motion.button
                                        key={card.key}
                                        type='button'
                                        aria-label={`View ${title}`}
                                        aria-pressed={isTop}
                                        onClick={() => setTopIndex(i)}
                                        style={{ zIndex: isTop ? 30 : card.z }}
                                        animate={{ scale: isTop ? 1.04 : 1 }}
                                        whileHover={{ scale: isTop ? 1.06 : 1.03 }}
                                        whileTap={{ scale: 0.98 }}
                                        transition={{ type: 'spring', stiffness: 300, damping: 22 }}
                                        className={`absolute h-71 w-50 overflow-hidden rounded-[8px] border-none bg-it-border p-0 shadow-it-md cursor-pointer lg:h-100 lg:w-71.25 lg:rounded-[15px] ${card.position}`}
                                    >
                                        <Image
                                            src={card.image}
                                            alt={title}
                                            fill
                                            sizes='(max-width: 1024px) 200px, 285px'
                                            className='object-cover'
                                        />
                                        <span className='absolute inset-x-0 bottom-0 flex items-center justify-center bg-it-heading/30 py-4 font-medium text-[14px] leading-[1.6] tracking-[-0.012em] text-it-white lg:py-5 lg:text-[20px]'>
                                            {title}
                                        </span>
                                    </motion.button>
                                );
                            })}
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
