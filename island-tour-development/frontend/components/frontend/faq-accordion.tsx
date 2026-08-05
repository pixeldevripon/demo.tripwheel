'use client';

import { springPop } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Reveal } from './reveal';

// Design v2 chevron (mockup .faq summary icon) - colour inherits via
// currentColor, rotates open.
function Caret({ className }: { className?: string }) {
    return (
        <svg
            viewBox='0 0 24 24'
            fill='none'
            aria-hidden='true'
            className={className}>
            <path
                d='m6 9 6 6 6-6'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeLinecap='round'
                strokeLinejoin='round'
            />
        </svg>
    );
}

/**
 * FAQ accordion - the FAQ section's only interactive portion, isolated as the
 * client leaf (the section shell stays a server component). Rows stagger in
 * per the sitewide list rule; the open row height-collapses.
 */
export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <div className='flex flex-1 flex-col gap-2.5'>
            {items.map((faq, i) => {
                const open = i === openIndex;
                return (
                    <Reveal key={faq.q} listItem>
                        <div className='rounded-it-md border border-it-divider bg-it-white shadow-it-sm'>
                            <motion.button
                                type='button'
                                aria-expanded={open}
                                onClick={() => setOpenIndex(open ? -1 : i)}
                                transition={springPop}
                                className='flex w-full items-center justify-between gap-3.5 border-none bg-transparent px-[18px] py-[15px] text-left cursor-pointer'>
                                <span className='font-bold text-[14.5px] leading-[1.6] text-it-ink'>
                                    {faq.q}
                                </span>
                                <motion.span
                                    className='inline-flex shrink-0 text-it-ink'
                                    animate={{ rotate: open ? 180 : 0 }}
                                    transition={{
                                        duration: 0.6,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}>
                                    <Caret className='size-4' />
                                </motion.span>
                            </motion.button>

                            <AnimatePresence initial={false}>
                                {open && (
                                    <motion.div
                                        key='content'
                                        initial={{ height: 0 }}
                                        animate={{ height: 'auto' }}
                                        exit={{ height: 0 }}
                                        transition={{
                                            duration: 0.6,
                                            ease: [0.22, 1, 0.36, 1],
                                        }}
                                        className='overflow-hidden'>
                                        <motion.div
                                            initial={{ opacity: 0, y: -6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: -6 }}
                                            transition={{
                                                duration: 0.5,
                                                ease: 'easeOut',
                                            }}
                                            className='px-[18px] pb-[15px]'>
                                            <div className='mb-3 h-px w-full bg-it-divider' />
                                            <p className='m-0 text-[13.5px] leading-[1.6] text-it-text-muted'>
                                                {faq.a}
                                            </p>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </Reveal>
                );
            })}
        </div>
    );
}

