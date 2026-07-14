'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';
import { useState } from 'react';
import { springPop } from '@/lib/motion';

type CategoryKey = 'buggy' | 'snorkel' | 'catamaran';

type CategoryCard = {
    key: CategoryKey;
    image: string;
    position: string; // fan offset + rotation (mobile base, lg override)
    z: number;
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

/**
 * The fanned category-card deck - the editorial banner's only interactive
 * portion (click lifts a card to the front), isolated as the client leaf.
 */
export function EditorialCardFan({
    labels,
}: {
    labels: Record<CategoryKey, string>;
}) {
    // Index of the card lifted to the front - defaults to the middle card
    const [topIndex, setTopIndex] = useState(2);

    return (
        <div className='relative -mx-6 h-78 sm:-mx-10 lg:absolute lg:right-12 lg:top-1/2 lg:mx-0 lg:h-100 lg:w-130 lg:-translate-y-1/2'>
            {categories.map((card, i) => {
                const isTop = i === topIndex;
                const title = labels[card.key];
                return (
                    <motion.button
                        key={card.key}
                        type='button'
                        aria-label={`View ${title}`}
                        aria-pressed={isTop}
                        onClick={() => setTopIndex(i)}
                        style={{ zIndex: isTop ? 30 : card.z }}
                        animate={{ scale: isTop ? 1.01 : 1 }}
                        whileTap={{ scale: 0.99 }}
                        transition={springPop}
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
    );
}
