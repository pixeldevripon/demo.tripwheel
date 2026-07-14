'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { useState, type ReactNode } from 'react';

export function TourSection({
    id,
    title,
    defaultOpen = true,
    children,
}: {
    id: string;
    title: string;
    defaultOpen?: boolean;
    children: ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <motion.section
            layout
            id={id}
            className='flex scroll-mt-36 flex-col gap-4'>
            <button
                type='button'
                onClick={() => setOpen(o => !o)}
                aria-expanded={open}
                className='flex w-full items-center justify-between gap-4 bg-transparent p-0 text-left'>
                <h2 className='m-0 font-medium text-[24px] leading-[1.2] tracking-[-0.012em] text-it-heading'>
                    {title}
                </h2>

                <motion.div
                    animate={{ rotate: open ? 0 : 180 }}
                    transition={{ duration: 0.3 }}>
                    <Image
                        src='/icons/section-collapse.svg'
                        alt=''
                        width={24}
                        height={24}
                    />
                </motion.div>
            </button>

            <motion.div
                layout
                initial={false}
                animate={{ height: open ? 'auto' : 0 }}
                transition={{ duration: 0.4, ease: [0.29, 1, 0.36, 1] }}
                className='overflow-hidden'>
                <AnimatePresence initial={false} mode='wait'>
                    {open && (
                        <motion.div
                            key='content'
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -12 }}
                            transition={{
                                duration: 0.25,
                                ease: [0.29, 1, 0.36, 1],
                            }}
                            className='flex flex-col gap-8 pt-4'>
                            {children}
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </motion.section>
    );
}
