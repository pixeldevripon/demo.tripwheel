'use client';

import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { localizeHref, type Locale } from '@/lib/constants/locales';

const springFast = { type: 'spring', stiffness: 400, damping: 17 } as const;

type FooterDict = {
    tagline: string;
    explore: string;
    legal: string;
    support: string;
    language: string;
    currency: string;
    links: {
        privacy: string;
        terms: string;
        cookies: string;
        help: string;
        contact: string;
    };
    trust: { secure: string; cancellation: string; experts: string };
};

const socials = [
    { src: '/footer/social/social-1.svg', alt: 'Instagram', href: '#' },
    { src: '/footer/social/social-2.svg', alt: 'Facebook', href: '#' },
    { src: '/footer/social/social-3.svg', alt: 'YouTube', href: '#' },
];

// Each badge SVG is exported as a uniform 74×41 Figma container with the
// logo centred inside — render them all at the same size to preserve Figma scale.
const paymentsRow1 = [
    { src: '/footer/payment/pay-1.svg', alt: 'Visa' },
    { src: '/footer/payment/pay-2.svg', alt: 'MasterCard' },
    { src: '/footer/payment/pay-3.svg', alt: 'PayPal' },
    { src: '/footer/payment/pay-4.svg', alt: 'iDEAL' },
];
const paymentsRow2 = [
    { src: '/footer/payment/pay-5.svg', alt: 'Apple Pay' },
    { src: '/footer/payment/pay-6.svg', alt: 'Google Pay' },
    { src: '/footer/payment/pay-7.svg', alt: 'Klarna' },
    { src: '/footer/payment/pay-8.svg', alt: 'American Express' },
];

function Selector({
    label,
    value,
    icon,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
}) {
    return (
        <div className='flex flex-col gap-1.5'>
            <span className='text-xl font-medium text-it-white'>{label}</span>
            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                transition={springFast}
                className='flex items-center justify-between gap-2 w-full bg-it-white rounded-it-full px-4 py-3 cursor-pointer border-none'>
                <span className='flex items-center gap-2'>
                    {icon}
                    <span className='text-base text-it-ink'>{value}</span>
                </span>
                <ChevronDown size={20} strokeWidth={1.5} className='text-it-ink' />
            </motion.button>
        </div>
    );
}

export function Footer({ locale, dict }: { locale: Locale; dict: FooterDict }) {
    const linkColumns = [
        {
            title: dict.explore,
            // Destination names are proper nouns — not translated, only the URL is localized.
            links: [
                { label: 'Curaçao', href: '/curacao' },
                { label: 'Aruba', href: '/aruba' },
                { label: 'Sint Maarten', href: '/sint-maarten' },
            ],
        },
        {
            title: dict.legal,
            links: [
                { label: dict.links.privacy, href: '/privacy' },
                { label: dict.links.terms, href: '/terms' },
                { label: dict.links.cookies, href: '/cookies' },
            ],
        },
        {
            title: dict.support,
            links: [
                { label: dict.links.help, href: '/help' },
                { label: dict.links.contact, href: '/contact' },
            ],
        },
    ];

    const trustItems = [dict.trust.secure, dict.trust.cancellation, dict.trust.experts];

    return (
        <footer className='bg-it-ink text-it-white'>
            <div className='it-container py-20'>
                {/* ── Top section: 5 columns ── */}
                <div className='flex flex-col lg:flex-row lg:justify-between gap-12 lg:gap-8'>
                    {/* Brand column */}
                    <div className='flex flex-col gap-6 max-w-52.5'>
                        <Link href={localizeHref(locale, '/')} className='inline-flex'>
                            <Image
                                src='/logo/footer-logo.png'
                                alt='Island Tours'
                                width={198}
                                height={147}
                                className='object-contain w-40 h-auto'
                            />
                        </Link>
                        <p className='m-0 text-base text-it-white/55 leading-snug'>
                            {dict.tagline}
                        </p>
                        <div className='flex items-center gap-3'>
                            {socials.map((s) => (
                                <Link
                                    key={s.alt}
                                    href={s.href}
                                    aria-label={s.alt}
                                    className='inline-flex'>
                                    <motion.span
                                        className='inline-flex'
                                        whileHover={{ y: -3, scale: 1.12 }}
                                        whileTap={{ scale: 0.9 }}
                                        transition={springFast}>
                                        <Image
                                            src={s.src}
                                            alt={s.alt}
                                            width={24}
                                            height={24}
                                            className='size-6'
                                        />
                                    </motion.span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Link columns — 2-col grid on mobile (Explore+Legal, then Support),
                        dissolves into the flex row on desktop via lg:contents */}
                    <div className='grid grid-cols-2 gap-x-8 gap-y-12 lg:contents'>
                        {linkColumns.map((col) => (
                            <div key={col.title} className='flex flex-col gap-8'>
                                <h3 className='m-0 text-xl font-medium text-it-white'>
                                    {col.title}
                                </h3>
                                <ul className='list-none m-0 p-0 flex flex-col gap-3'>
                                    {col.links.map((link) => (
                                        <li key={link.label}>
                                            <Link
                                                href={localizeHref(locale, link.href)}
                                                className='inline-block text-base text-it-white/55 hover:text-it-white no-underline transition-colors'>
                                                <motion.span
                                                    className='inline-block'
                                                    whileHover={{ x: 4 }}
                                                    transition={springFast}>
                                                    {link.label}
                                                </motion.span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Right column: selectors + payments */}
                    <div className='flex flex-col gap-8 w-full max-w-73.5'>
                        <Selector
                            label={dict.language}
                            value='English (EN)'
                            icon={
                                <Image
                                    src='/icons/nav-globe.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6'
                                />
                            }
                        />
                        <Selector
                            label={dict.currency}
                            value='USD ($)'
                            icon={
                                <Image
                                    src='/footer/currency.svg'
                                    alt=''
                                    width={24}
                                    height={24}
                                    className='size-6'
                                />
                            }
                        />

                        {/* Payment badges — uniform 74×41 containers, Figma scale preserved */}
                        <div className='flex flex-col gap-4'>
                            {[paymentsRow1, paymentsRow2].map((row, i) => (
                                <div
                                    key={i}
                                    className='flex items-center justify-between'>
                                    {row.map((p) => (
                                        <motion.span
                                            key={p.alt}
                                            className='inline-flex'
                                            whileHover={{ scale: 1.1 }}
                                            transition={springFast}>
                                            <Image
                                                src={p.src}
                                                alt={p.alt}
                                                width={74}
                                                height={41}
                                                className='h-10 w-auto'
                                            />
                                        </motion.span>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Bottom bar ── */}
                <div className='mt-20 lg:mt-27.5'>
                    <div className='h-px bg-it-white/15' />
                    <div className='pt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2'>
                        {trustItems.map((item, i) => (
                            <div key={item} className='flex items-center gap-6'>
                                <span className='text-base text-it-white/55'>
                                    {item}
                                </span>
                                {i < trustItems.length - 1 && (
                                    <span className='size-1.25 rounded-full bg-it-ink-muted' />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
