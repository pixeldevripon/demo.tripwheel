'use client';

import { springPop } from '@/lib/motion';
import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Reveal } from './reveal';

// Exact Figma caret (vuesax/linear arrow-down) - colour inherits via currentColor, rotates open
function Caret({ className }: { className?: string }) {
    return (
        <svg
            viewBox='0 0 24 24'
            fill='none'
            aria-hidden='true'
            className={className}>
            <path
                d='M4.07992 8.9502L10.5999 15.4702C11.3699 16.2402 12.6299 16.2402 13.3999 15.4702L19.9199 8.9502'
                stroke='currentColor'
                strokeWidth='1.5'
                strokeMiterlimit='10'
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
        <div className='flex flex-1 flex-col gap-3 lg:gap-4'>
            {items.map((faq, i) => {
                const open = i === openIndex;
                return (
                    <Reveal key={faq.q} delay={0.2 + i * 0.06}>
                        <div
                            className={`rounded-it-md border border-it-heading/10 transition-colors ${open ? 'bg-it-white' : 'bg-transparent'}`}>
                            <motion.button
                                type='button'
                                aria-expanded={open}
                                onClick={() => setOpenIndex(open ? -1 : i)}
                                transition={springPop}
                                className='flex w-full items-center justify-between gap-4 border-none bg-transparent p-2.5 text-left cursor-pointer lg:gap-6 lg:px-6 lg:py-5'>
                                <span className='font-medium text-[16px] lg:text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                    {faq.q}
                                </span>
                                <motion.span
                                    className='inline-flex shrink-0 text-it-heading'
                                    animate={{ rotate: open ? 180 : 0 }}
                                    transition={{
                                        duration: 0.6,
                                        ease: [0.22, 1, 0.36, 1],
                                    }}>
                                    <Caret className='size-6' />
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
                                                duration: 0.50,
                                                ease: 'easeOut',
                                            }}
                                            className='px-2.5 pb-2.5 lg:px-6 lg:pb-5'>
                                            <div className='mb-3 h-px w-full bg-it-heading/10 lg:mb-4' />
                                            <p className='m-0 text-[14px] lg:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
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

