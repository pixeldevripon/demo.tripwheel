'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Reveal } from './reveal';

export type AboutDict = {
    title: string;
    description: string;
    learnMore: string;
    topThings: string;
    planning: string;
    whyBook: string;
};

export function DestinationAbout({
    destinationName,
    dict,
}: {
    destinationName: string;
    dict: AboutDict;
}) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Split the description into two paragraphs for the read more/less functionality.
    const paragraphs = dict.description.split('. ');
    const firstParagraph = paragraphs.slice(0, Math.ceil(paragraphs.length / 2)).join('. ');
    const secondParagraph = paragraphs.slice(Math.ceil(paragraphs.length / 2)).join('. ').replace(/\.*$/, '.');

    return (
        <section className='it-section pt-[32px]! bg-it-surface border-b border-it-heading/5'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-10 md:gap-12'>
                    {/* Top Section: Title & Body Copy */}
                    <div className='flex flex-col gap-6 md:gap-8'>
                        <h2 className='m-0 font-medium text-[32px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                            {dict.title.replace(
                                '{destination}',
                                destinationName
                            )}
                        </h2>

                        <p className='m-0 text-base md:text-lg leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                            <span>{firstParagraph}{isExpanded ? '.' : '...'}</span>
                            <AnimatePresence initial={false}>
                                {isExpanded && (
                                    <motion.span
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                        className='inline'
                                    >
                                        {' '}{secondParagraph}
                                    </motion.span>
                                )}
                            </AnimatePresence>
                            <button
                                type='button'
                                onClick={() => setIsExpanded(!isExpanded)}
                                className='inline cursor-pointer border-none bg-transparent p-0 font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-4 transition-colors hover:text-it-primary ml-1.5'
                            >
                                {isExpanded ? 'Read Less' : dict.learnMore}
                            </button>
                        </p>
                    </div>

                    {/* Bottom Section: Three Columns & Divider Line */}
                    <div className='flex flex-col gap-10 md:gap-12'>
                        {/* 3 Horizontal navigation columns */}
                        <div className='flex flex-col md:flex-row md:justify-between items-start md:items-center gap-6 md:gap-0 w-full'>
                            <a
                                href='#experiences'
                                className='flex items-center gap-2 text-it-heading no-underline hover:text-it-primary transition-colors group'>
                                <div className='relative size-6 shrink-0 transition-transform duration-300 group-hover:scale-110'>
                                    <Image
                                        src='/icons/check-green.svg'
                                        alt=''
                                        fill
                                        className='object-contain'
                                    />
                                </div>
                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                    {dict.topThings}
                                </span>
                            </a>

                            <a
                                href='#planning'
                                className='flex items-center gap-2 text-it-heading no-underline hover:text-it-primary transition-colors group'>
                                <div className='relative size-6 shrink-0 transition-transform duration-300 group-hover:scale-110'>
                                    <Image
                                        src='/icons/check-green.svg'
                                        alt=''
                                        fill
                                        className='object-contain'
                                    />
                                </div>
                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                    {dict.planning}
                                </span>
                            </a>

                            <a
                                href='#faq'
                                className='flex items-center gap-2 text-it-heading no-underline hover:text-it-primary transition-colors group'>
                                <div className='relative size-6 shrink-0 transition-transform duration-300 group-hover:scale-110'>
                                    <Image
                                        src='/icons/check-green.svg'
                                        alt=''
                                        fill
                                        className='object-contain'
                                    />
                                </div>
                                <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em]'>
                                    {dict.whyBook}
                                </span>
                            </a>
                        </div>

                        {/* Divider line matching Line 18 in Figma (rgba(44,44,44,0.1) opacity stroke) */}
                        <div className='w-full h-px bg-it-heading/10' />
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

