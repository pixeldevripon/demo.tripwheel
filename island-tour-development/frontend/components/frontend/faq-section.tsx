'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Reveal } from './reveal';

// Exact Figma caret (vuesax/linear arrow-down) - colour inherits via currentColor, rotates open
function Caret({ className }: { className?: string }) {
    return (
        <svg
            viewBox='0 0 24 24'
            fill='none'
            aria-hidden='true'
            className={className}
        >
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

type FaqDict = {
    title: string;
    subtitle: string;
    whatsapp: string;
    guarantees: string[];
    items: { q: string; a: string }[];
};

const payments = [
    { src: '/icons/payments/pay-1.svg', alt: 'Visa' },
    { src: '/icons/payments/pay-2.svg', alt: 'MasterCard' },
    { src: '/icons/payments/pay-3.svg', alt: 'PayPal' },
    { src: '/icons/payments/pay-4.svg', alt: 'iDEAL' },
    { src: '/icons/payments/pay-5.svg', alt: 'Apple Pay' },
    { src: '/icons/payments/pay-6.svg', alt: 'Google Pay' },
    { src: '/icons/payments/pay-7.svg', alt: 'Klarna' },
    { src: '/icons/payments/pay-8.svg', alt: 'American Express' },
];

export function FaqSection({ dict, minimal = false }: { dict: FaqDict; minimal?: boolean }) {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section className='it-section max-md:pb-[32px]! bg-it-surface'>
            <div className='it-container'>
                <Reveal className={`flex flex-col lg:flex-row lg:gap-[118px] ${minimal ? 'gap-4' : 'gap-12'}`}>
                    {/* Minimal (category page, Figma 47070:2456): title only on the left. */}
                    {minimal ? (
                        <div className='lg:w-113 lg:shrink-0'>
                            <h2 className='m-0 font-medium text-[24px] lg:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-ink'>
                                {dict.title}
                            </h2>
                        </div>
                    ) : (
                    /* Left - help, WhatsApp, guarantees, payments.
                        On mobile this block sits above the accordion (matches Figma). */
                    <div className='flex flex-col gap-8 lg:w-115 lg:gap-14'>
                        <div className='flex flex-col gap-12 lg:gap-14'>
                            {/* Heading */}
                            <div className='flex flex-col gap-4 lg:gap-6'>
                                <h2 className='m-0 font-medium text-[32px] lg:text-[40px] leading-[1.2] tracking-[-0.012em] text-it-ink'>
                                    {dict.title}
                                </h2>
                                <p className='m-0 max-w-[452px] text-[14px] lg:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    {dict.subtitle}
                                </p>
                            </div>

                            {/* WhatsApp + guarantees */}
                            <div className='flex flex-col gap-6'>
                                <div className='flex items-center gap-2'>
                                    <Image
                                        src='/images/home-page/faq/host-avatar.png'
                                        alt='Your local host'
                                        width={64}
                                        height={64}
                                        className='size-12.5 shrink-0 lg:size-16'
                                    />
                                    <motion.a
                                        href='#'
                                        className='flex items-center gap-2.5 rounded-it-full bg-it-green px-10 py-3 no-underline lg:py-[19px]'
                                        whileHover={{ scale: 1.01 }}
                                        whileTap={{ scale: 0.97 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 18 }}
                                    >
                                        <Image
                                            src='/icons/whatsapp.svg'
                                            alt=''
                                            width={24}
                                            height={24}
                                            className='size-6'
                                        />
                                        <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-white'>
                                            {dict.whatsapp}
                                        </span>
                                    </motion.a>
                                </div>

                                <ul className='m-0 flex list-none flex-col gap-2 p-0'>
                                    {dict.guarantees.map((g) => (
                                        <li key={g} className='flex items-center gap-2'>
                                            <Image
                                                src='/icons/check-green.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-6 shrink-0'
                                            />
                                            <span className='font-medium text-[14px] lg:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                {g}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Payment badges - uniform 64×36 (mobile) / 73×40 (desktop) boxes, packed */}
                        <div className='grid w-64 grid-cols-4 gap-y-2 lg:w-73'>
                            {payments.map((p) => (
                                <span key={p.alt} className='flex items-center justify-center'>
                                    <Image
                                        src={p.src}
                                        alt={p.alt}
                                        width={73}
                                        height={40}
                                        className='w-16 h-auto object-contain lg:w-18.25'
                                    />
                                </span>
                            ))}
                        </div>
                    </div>
                    )}

                    {/* Right - accordion */}
                    <div className='flex flex-1 flex-col gap-3 lg:gap-4'>
                        {dict.items.map((faq, i) => {
                            const open = i === openIndex;
                            return (
                                <div
                                    key={faq.q}
                                    className={`rounded-it-md border border-it-heading/10 transition-colors ${open ? 'bg-it-white' : 'bg-transparent'}`}
                                >
                                    <button
                                        type='button'
                                        aria-expanded={open}
                                        onClick={() => setOpenIndex(open ? -1 : i)}
                                        className='flex w-full items-center justify-between gap-4 border-none bg-transparent p-2.5 text-left cursor-pointer lg:gap-6 lg:px-6 lg:py-5'
                                    >
                                        <span className='font-medium text-[16px] lg:text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                            {faq.q}
                                        </span>
                                        <motion.span
                                            className='inline-flex shrink-0 text-it-heading'
                                            animate={{ rotate: open ? 180 : 0 }}
                                            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                                        >
                                            <Caret className='size-6' />
                                        </motion.span>
                                    </button>

                                    <AnimatePresence initial={false}>
                                        {open && (
                                            <motion.div
                                                key='content'
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.35, ease: [0.04, 0.62, 0.23, 0.98] }}
                                                className='overflow-hidden'
                                            >
                                                <div className='px-2.5 pb-2.5 lg:px-6 lg:pb-5'>
                                                    <div className='mb-3 h-px w-full bg-it-heading/10 lg:mb-4' />
                                                    <p className='m-0 text-[14px] lg:text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                                        {faq.a}
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            );
                        })}
                    </div>
                </Reveal>
            </div>
        </section>
    );
}
