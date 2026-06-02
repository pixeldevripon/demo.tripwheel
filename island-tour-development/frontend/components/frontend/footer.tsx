'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
    ALL_LOCALES,
    LOCALE_COOKIE,
    LOCALE_NATIVE_LABELS,
    localeFlag,
    localizeHref,
    type Locale,
} from '@/lib/constants/locales';

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
            <span className='text-lg font-medium text-it-white lg:text-xl'>{label}</span>
            <button
                type='button'
                className='flex items-center justify-between gap-2 w-full bg-it-white rounded-it-full px-4 py-3 cursor-pointer border-none'>
                <span className='flex items-center gap-2'>
                    {icon}
                    <span className='text-sm text-it-ink lg:text-base'>{value}</span>
                </span>
                <ChevronDown size={20} strokeWidth={1.5} className='text-it-ink' />
            </button>
        </div>
    );
}

/** Interactive language selector — opens upward, switches locale (same behaviour as the navbar). */
function LanguageSelector({ locale, label }: { locale: Locale; label: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setOpen(false);
            }
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);

    function switchLocale(next: Locale) {
        setOpen(false);
        if (next === locale) return;
        const segments = pathname.split('/');
        segments[1] = next;
        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
        router.push(segments.join('/') || `/${next}`);
    }

    return (
        <div className='flex flex-col gap-1.5'>
            <span className='text-lg font-medium text-it-white lg:text-xl'>{label}</span>
            <div ref={ref} className='relative'>
                <button
                    type='button'
                    aria-expanded={open}
                    onClick={() => setOpen((v) => !v)}
                    className='flex items-center justify-between gap-2 w-full bg-it-white rounded-it-full px-4 py-3 cursor-pointer border-none'>
                    <span className='flex items-center gap-2'>
                        <Image
                            src='/icons/nav-globe.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-6'
                        />
                        <span className='text-sm text-it-ink lg:text-base'>
                            {LOCALE_NATIVE_LABELS[locale]} ({locale.toUpperCase()})
                        </span>
                    </span>
                    <motion.span
                        className='inline-flex'
                        animate={{ rotate: open ? 180 : 0 }}
                        transition={{ duration: 0.2 }}>
                        <ChevronDown size={20} strokeWidth={1.5} className='text-it-ink' />
                    </motion.span>
                </button>

                <AnimatePresence>
                    {open && (
                        <motion.ul
                            initial={{ opacity: 0, y: 8, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.97 }}
                            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                            className='absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 m-0 list-none origin-bottom overflow-hidden rounded-it-lg border border-it-border bg-it-white p-0 shadow-it-lg'>
                            {ALL_LOCALES.map((code) => (
                                <li key={code}>
                                    <button
                                        type='button'
                                        onClick={() => switchLocale(code)}
                                        aria-current={code === locale}
                                        className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm bg-transparent border-none cursor-pointer transition-colors hover:bg-it-surface ${code === locale ? 'text-it-primary font-medium' : 'text-it-ink'}`}>
                                        <span className='flex items-center gap-2.5'>
                                            <span className='relative inline-block size-5 overflow-hidden rounded-full ring-1 ring-black/10 shrink-0'>
                                                <Image
                                                    src={localeFlag(code)}
                                                    alt=''
                                                    fill
                                                    sizes='20px'
                                                    className='object-cover'
                                                />
                                            </span>
                                            {LOCALE_NATIVE_LABELS[code]}
                                        </span>
                                        <span className='uppercase text-xs text-it-ink-muted'>
                                            {code}
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </motion.ul>
                    )}
                </AnimatePresence>
            </div>
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
            <div className='it-container py-12 lg:py-20'>
                {/* ── Top section: grid on mobile (Brand|Explore, Legal|Support), flex row on desktop ── */}
                <div className='grid grid-cols-2 gap-x-8 gap-y-16 lg:flex lg:flex-row lg:justify-between lg:gap-8'>
                    {/* Brand column */}
                    <div className='flex flex-col gap-4 max-w-52.5 lg:gap-6'>
                        <Link href={localizeHref(locale, '/')} className='inline-flex'>
                            <Image
                                src='/logo/footer-logo.png'
                                alt='Island Tours'
                                width={198}
                                height={147}
                                className='object-contain w-34 h-auto lg:w-40'
                            />
                        </Link>
                        <p className='m-0 text-sm text-it-white/55 leading-snug lg:text-base'>
                            {dict.tagline}
                        </p>
                        <div className='flex items-center gap-2 lg:gap-3'>
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
                                            className='size-5 lg:size-6'
                                        />
                                    </motion.span>
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Link columns — grid cells on mobile, flex items on desktop */}
                    {linkColumns.map((col) => (
                        <div key={col.title} className='flex flex-col gap-5 lg:gap-8'>
                            <h3 className='m-0 text-lg font-medium text-it-white lg:text-xl'>
                                {col.title}
                            </h3>
                            <ul className='list-none m-0 p-0 flex flex-col gap-2 lg:gap-3'>
                                {col.links.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={localizeHref(locale, link.href)}
                                            className='inline-block text-sm text-it-white/55 hover:text-it-white no-underline transition-colors lg:text-base'>
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

                    {/* Right column: selectors + payments — full-width row on mobile (capped on tablet) */}
                    <div className='col-span-2 flex flex-col gap-8 w-full max-w-md lg:max-w-73.5'>
                        <LanguageSelector locale={locale} label={dict.language} />
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

                        {/* Payment badges — uniform 64×36 (mobile) / 73×40 (desktop) boxes, packed */}
                        <div className='grid w-64 grid-cols-4 gap-y-2 lg:w-73'>
                            {[...paymentsRow1, ...paymentsRow2].map((p) => (
                                <motion.span
                                    key={p.alt}
                                    className='flex items-center justify-center'
                                    whileHover={{ scale: 1.1 }}
                                    transition={springFast}>
                                    <Image
                                        src={p.src}
                                        alt={p.alt}
                                        width={74}
                                        height={41}
                                        className='w-16 h-auto object-contain lg:w-18.25'
                                    />
                                </motion.span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* ── Bottom bar ── */}
                <div className='mt-14 lg:mt-27.5'>
                    <div className='h-px bg-it-white/15' />
                    <div className='pt-6 flex flex-wrap items-center justify-start gap-x-6 gap-y-2 lg:justify-center'>
                        {trustItems.map((item, i) => (
                            <div key={item} className='flex items-center gap-6'>
                                {i > 0 && (
                                    <span className='size-1.25 shrink-0 rounded-full bg-it-ink-muted' />
                                )}
                                <span className='text-sm text-it-white/55 lg:text-base'>
                                    {item}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </footer>
    );
}
