'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import { Reveal } from './reveal';

// Exact Figma caret (vuesax/linear arrow-down) — colour inherits via currentColor, rotates open
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

const faqs = [
    {
        q: 'Can I cancel if my plans change?',
        a: 'Most tours can be cancelled up to 24h before for a full refund. No forms, just message us.',
    },
    {
        q: 'Do I have to pay in full now?',
        a: 'No — you can secure your spot with just 20% upfront and pay the remaining balance closer to your tour date.',
    },
    {
        q: 'Who is behind Island Tours?',
        a: "We're a team of islanders who grew up on Curaçao, Aruba, and Sint Maarten. Every tour is one we've personally vetted.",
    },
    {
        q: 'What if my tour gets cancelled?',
        a: 'If a tour is cancelled by the operator, you get a full refund within 24 hours — no questions asked.',
    },
    {
        q: "Not sure which tour? We'll help.",
        a: "Chat with us on WhatsApp anytime. Tell us what you're after and we'll give you honest, local recommendations.",
    },
];

const guarantees = [
    'Free cancellation — no questions asked',
    'Reserve from 20% · pay the rest later',
    'Confirmed in seconds',
    'Safe & secure checkout',
];

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

export function FaqSection() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section className='it-section bg-it-surface'>
            <div className='it-container'>
                <Reveal className='flex flex-col gap-14 lg:flex-row lg:gap-[118px]'>
                    {/* Left — help, WhatsApp, guarantees, payments */}
                    <div className='flex flex-col gap-14 lg:w-115'>
                        <div className='flex flex-col gap-14'>
                            {/* Heading */}
                            <div className='flex flex-col gap-6'>
                                <h2 className='m-0 font-medium text-[40px] leading-[1.2] tracking-[-0.012em] text-it-ink'>
                                    Need help before booking?
                                </h2>
                                <p className='m-0 max-w-[452px] text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
                                    We&rsquo;re locals. We grew up here, we know these tours, and we want
                                    you to have the best time on these islands.
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
                                        className='size-16 shrink-0'
                                    />
                                    <motion.a
                                        href='#'
                                        className='flex items-center gap-2.5 rounded-it-full bg-it-green px-10 py-[19px] no-underline'
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
                                            Chat on WhatsApp
                                        </span>
                                    </motion.a>
                                </div>

                                <ul className='m-0 flex list-none flex-col gap-2 p-0'>
                                    {guarantees.map((g) => (
                                        <li key={g} className='flex items-center gap-2'>
                                            <Image
                                                src='/icons/check-green.svg'
                                                alt=''
                                                width={24}
                                                height={24}
                                                className='size-6 shrink-0'
                                            />
                                            <span className='font-medium text-[16px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
                                                {g}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Payment badges */}
                        <div className='grid w-[294px] grid-cols-4 gap-y-1'>
                            {payments.map((p) => (
                                <span key={p.alt} className='flex h-10 items-center justify-center'>
                                    <Image
                                        src={p.src}
                                        alt={p.alt}
                                        width={73}
                                        height={40}
                                        className='h-7 w-auto object-contain'
                                    />
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Right — accordion */}
                    <div className='flex flex-1 flex-col gap-4'>
                        {faqs.map((faq, i) => {
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
                                        className='flex w-full items-center justify-between gap-6 border-none bg-transparent px-6 py-5 text-left cursor-pointer'
                                    >
                                        <span className='font-medium text-[18px] leading-[1.6] tracking-[-0.012em] text-it-heading'>
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
                                                <div className='px-6 pb-5'>
                                                    <div className='mb-4 h-px w-full bg-it-heading/10' />
                                                    <p className='m-0 text-[16px] leading-[1.6] tracking-[-0.012em] text-it-text-muted'>
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
