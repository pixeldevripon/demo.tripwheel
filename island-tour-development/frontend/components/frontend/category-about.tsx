'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Reveal } from './reveal';

/**
 * Category-page "About" block (Figma node 47171:5647). A simpler twin of
 * <DestinationAbout>: heading + body copy with an inline "Learn More" expander,
 * on the #f8f8f8 band. No three-column nav / divider (that's the destination
 * variant).
 */
export function CategoryAbout({
    title,
    description,
    learnMoreLabel,
    readLessLabel,
}: {
    title: string;
    description: string;
    learnMoreLabel: string;
    readLessLabel: string;
}) {
    const [expanded, setExpanded] = useState(false);

    // Split into two halves for the read-more/less reveal (same as DestinationAbout).
    const parts = description.split('. ');
    const first = parts.slice(0, Math.ceil(parts.length / 2)).join('. ');
    const second = parts
        .slice(Math.ceil(parts.length / 2))
        .join('. ')
        .replace(/\.*$/, '.');
    const hasMore = second.trim().length > 1;

    return (
        // Desktop: 130px top / 20px bottom (tight gap to the FAQ band).
        // Mobile: 32px top / 0 bottom - the FAQ band's 64px top makes the gap.
        <section className='it-section md:pb-5! max-md:pt-8! max-md:pb-0! bg-it-surface'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-4 md:gap-10'>
                    <h2 className='m-0 font-medium text-[24px] md:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                        {title}
                    </h2>

                    <p className='m-0 text-[14px] md:text-[18px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                        <span>
                            {first}
                            {hasMore && !expanded ? '...' : '.'}
                        </span>
                        <AnimatePresence initial={false}>
                            {expanded && hasMore && (
                                <motion.span
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.3 }}
                                    className='inline'>
                                    {' '}
                                    {second}
                                </motion.span>
                            )}
                        </AnimatePresence>
                        {hasMore && (
                            <button
                                type='button'
                                onClick={() => setExpanded((v) => !v)}
                                className='ml-1.5 inline cursor-pointer border-none bg-transparent p-0 font-medium text-[14px] md:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading underline decoration-1 underline-offset-4 transition-colors hover:text-it-primary'>
                                {expanded ? readLessLabel : learnMoreLabel}
                            </button>
                        )}
                    </p>
                </Reveal>
            </div>
        </section>
    );
}
