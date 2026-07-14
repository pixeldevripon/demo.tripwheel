'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { Reveal } from '@/components/frontend/reveal';
import { springPop } from '@/lib/motion';
import {
    ALL_CURRENCIES,
    ALL_LOCALES,
    CURRENCY_COOKIE,
    CURRENCY_LABELS,
    CURRENCY_NAMES,
    isCurrency,
    LOCALE_COOKIE,
    LOCALE_NATIVE_LABELS,
    localizeHref,
    type Currency,
    type Locale,
} from '@/lib/constants/locales';

/** Canonical press/nudge spring (from the @/lib/motion standard). */
const springFast = springPop;

type FooterDict = {
    tagline: string;
    ourStory: string;
    explore: string;
    support: string;
    workWithUs: string;
    legal: string;
    language: string;
    currency: string;
    links: {
        boatTours: string;
        buggyTours: string;
        sunsetCruises: string;
        help: string;
        contact: string;
        listTour: string;
        affiliate: string;
        privacy: string;
        cookies: string;
        terms: string;
        cancellation: string;
        legalNotice: string;
    };
    copyright: string;
    registration: string;
    manageCookies: string;
};

// Social ring icons - each SVG bakes in the grey-ringed circle + white glyph.
const socials = [
    { src: '/footer/social/social-1.svg', alt: 'Instagram', href: '#' },
    { src: '/footer/social/social-2.svg', alt: 'Facebook', href: '#' },
    { src: '/footer/social/social-3.svg', alt: 'YouTube', href: '#' },
    { src: '/footer/social/social-4.svg', alt: 'TikTok', href: '#' },
];

// Payment marks - white Figma glyphs. `cls` carries the exact mobile + desktop
// box from Figma (mobile renders ~1.6× larger than desktop).
const paymentsRow1 = [
    { src: '/footer/payment/pay-1.svg', alt: 'Visa', w: 55, h: 20, cls: 'h-5 w-[55px] lg:h-3 lg:w-[34px]' },
    { src: '/footer/payment/pay-2.svg', alt: 'Mastercard', w: 38, h: 23, cls: 'h-[23px] w-[38px] lg:h-3.5 lg:w-[23px]' },
    { src: '/footer/payment/pay-3.svg', alt: 'PayPal', w: 43, h: 41, cls: 'h-[41px] w-[43px] lg:h-[25px] lg:w-[26px]' },
    { src: '/footer/payment/pay-4.svg', alt: 'iDEAL', w: 41, h: 38, cls: 'h-[38px] w-[41px] lg:h-[25px] lg:w-[25px]' },
];
const paymentsRow2 = [
    { src: '/footer/payment/pay-5.svg', alt: 'Apple Pay', w: 51, h: 23, cls: 'h-[23px] w-[51px] lg:h-3.5 lg:w-[31px]' },
    { src: '/footer/payment/pay-6.svg', alt: 'Google Pay', w: 68, h: 26, cls: 'h-6.5 w-[68px] lg:h-4 lg:w-[41px]' },
    { src: '/footer/payment/pay-7.svg', alt: 'Klarna', w: 56, h: 18, cls: 'h-[18px] w-[56px] lg:h-[11px] lg:w-[35px]' },
    { src: '/footer/payment/pay-8.svg', alt: 'American Express', w: 58, h: 21, cls: 'h-[21px] w-[58px] lg:h-[13px] lg:w-[35px]' },
];

/** White pill selector shared shell - icon + label on the left, rotating caret on the right. */
function SelectorPill({
    icon,
    label,
    open,
    onToggle,
    ariaLabel,
    children,
    pillRef,
    busy = false,
}: {
    icon: React.ReactNode;
    label: string;
    open: boolean;
    onToggle: () => void;
    ariaLabel: string;
    children: React.ReactNode;
    pillRef: React.RefObject<HTMLDivElement | null>;
    busy?: boolean;
}) {
    return (
        <div ref={pillRef} className='relative w-full'>
            <motion.button
                type='button'
                aria-label={ariaLabel}
                aria-expanded={open}
                aria-busy={busy}
                onClick={onToggle}
                whileTap={{ scale: 0.98 }}
                transition={springFast}
                className={`flex h-12.5 w-full cursor-pointer items-center justify-between gap-2 rounded-it-full border-none bg-it-white px-4 py-3 transition-opacity duration-300 ${busy ? 'opacity-50' : 'opacity-100'}`}>
                <span className='flex items-center gap-2'>
                    {icon}
                    <span className='text-sm leading-[1.6] tracking-[-0.012em] text-it-heading lg:text-base'>
                        {label}
                    </span>
                </span>
                <motion.span
                    className='inline-flex'
                    animate={{ rotate: open ? 180 : 0 }}
                    transition={{ duration: 0.2 }}>
                    <Image src='/footer/arrow-down.svg' alt='' width={24} height={24} className='size-6' />
                </motion.span>
            </motion.button>
            <AnimatePresence>{open && children}</AnimatePresence>
        </div>
    );
}

/**
 * Dropdown list rendered above the pill. Same spring + item-cascade language
 * as the navbar dropdowns, mirrored for the upward opening direction.
 */
const footerMenuMotion = {
    initial: 'closed',
    animate: 'open',
    exit: 'closed',
    variants: {
        open: {
            opacity: 1,
            y: 0,
            scale: 1,
            transition: {
                ...springPop,
                staggerChildren: 0.03,
                delayChildren: 0.02,
            },
        },
        closed: {
            opacity: 0,
            y: 10,
            scale: 0.96,
            transition: { duration: 0.18, ease: [0.4, 0, 0.2, 1] },
        },
    },
} as const;

/** Per-item cascade inside a `footerMenuMotion` list (rises with the panel). */
const footerMenuItemMotion = {
    variants: {
        open: { opacity: 1, y: 0, transition: springPop },
        closed: { opacity: 0, y: 6 },
    },
} as const;

function SelectorMenu({ children }: { children: React.ReactNode }) {
    return (
        <motion.ul
            {...footerMenuMotion}
            className='absolute bottom-[calc(100%+8px)] left-0 right-0 z-50 m-0 list-none origin-bottom overflow-hidden rounded-it-lg border border-it-border bg-it-white p-0 shadow-it-lg'>
            {children}
        </motion.ul>
    );
}

/** Interactive currency selector - opens upward, defaults to USD. */
function CurrencySelector({ label }: { label: string }) {
    const [open, setOpen] = useState(false);
    const [currency, setCurrency] = useState<Currency>('USD');
    const ref = useRef<HTMLDivElement>(null);

    // Restore a previously chosen currency once mounted (starts from USD on both
    // server and client to avoid a hydration mismatch).
    useEffect(() => {
        const stored = document.cookie
            .split('; ')
            .find((row) => row.startsWith(`${CURRENCY_COOKIE}=`))
            ?.split('=')[1];
        if (isCurrency(stored)) setCurrency(stored);
    }, []);

    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);

    function selectCurrency(next: Currency) {
        setOpen(false);
        setCurrency(next);
        document.cookie = `${CURRENCY_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
    }

    return (
        <SelectorPill
            pillRef={ref}
            ariaLabel={label}
            label={CURRENCY_LABELS[currency]}
            open={open}
            onToggle={() => setOpen((v) => !v)}
            icon={<Image src='/footer/currency.svg' alt='' width={24} height={24} className='size-6' />}>
            <SelectorMenu>
                {ALL_CURRENCIES.map((code) => (
                    <motion.li key={code} {...footerMenuItemMotion}>
                        <button
                            type='button'
                            onClick={() => selectCurrency(code)}
                            aria-current={code === currency}
                            className={`flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-2.5 text-left text-sm transition-colors hover:bg-it-surface ${code === currency ? 'font-medium text-it-primary' : 'text-it-ink'}`}>
                            <span>{CURRENCY_NAMES[code]}</span>
                            <span className='text-xs uppercase text-it-ink-muted'>{code}</span>
                        </button>
                    </motion.li>
                ))}
            </SelectorMenu>
        </SelectorPill>
    );
}

/** Interactive language selector - opens upward, switches locale (same behaviour as the navbar). */
function LanguageSelector({ locale, label }: { locale: Locale; label: string }) {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [isPending, startTransition] = useTransition();
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function onPointerDown(event: PointerEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
        }
        document.addEventListener('pointerdown', onPointerDown);
        return () => document.removeEventListener('pointerdown', onPointerDown);
    }, []);

    function switchLocale(next: Locale) {
        setOpen(false);
        if (next === locale) return;
        const segments = pathname.split('/');
        segments[1] = next;
        const nextPath = segments.join('/') || `/${next}`;
        document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=${60 * 60 * 24 * 365};samesite=lax`;
        // scroll: false keeps the reader in the footer; startTransition swaps the
        // localized content in place instead of flashing a loading state.
        startTransition(() => {
            router.push(nextPath, { scroll: false });
        });
    }

    return (
        <SelectorPill
            pillRef={ref}
            ariaLabel={label}
            busy={isPending}
            label={`${LOCALE_NATIVE_LABELS[locale]} (${locale.toUpperCase()})`}
            open={open}
            onToggle={() => setOpen((v) => !v)}
            icon={<Image src='/footer/globe.svg' alt='' width={24} height={24} className='size-6' />}>
            <SelectorMenu>
                {ALL_LOCALES.map((code) => (
                    <motion.li key={code} {...footerMenuItemMotion}>
                        <button
                            type='button'
                            onClick={() => switchLocale(code)}
                            aria-current={code === locale}
                            className={`flex w-full cursor-pointer items-center justify-between gap-3 border-none bg-transparent px-4 py-2.5 text-left text-sm transition-colors hover:bg-it-surface ${code === locale ? 'font-medium text-it-primary' : 'text-it-ink'}`}>
                            <span>{LOCALE_NATIVE_LABELS[code]}</span>
                            <span className='text-xs uppercase text-it-ink-muted'>{code}</span>
                        </button>
                    </motion.li>
                ))}
            </SelectorMenu>
        </SelectorPill>
    );
}

/** A single link column (heading + list). */
function LinkColumn({
    locale,
    title,
    links,
    className,
}: {
    locale: Locale;
    title: string;
    links: { label: string; href: string }[];
    className?: string;
}) {
    return (
        <div className={`flex flex-col gap-5 lg:gap-8 ${className ?? ''}`}>
            <h3 className='m-0 text-lg font-medium leading-[1.6] tracking-[-0.012em] text-it-white lg:text-xl'>
                {title}
            </h3>
            <ul className='m-0 flex list-none flex-col gap-2 p-0 lg:gap-3'>
                {links.map((link) => (
                    <li key={link.label}>
                        <Link
                            href={localizeHref(locale, link.href)}
                            className='inline-block text-sm leading-[1.6] tracking-[-0.012em] text-it-footer-muted no-underline transition-colors duration-300 hover:text-it-white lg:text-base'>
                            {link.label}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}

/** One payment-mark row (space-between on both breakpoints). */
function PaymentRow({ items }: { items: typeof paymentsRow1 }) {
    return (
        <div className='flex items-center justify-between gap-4'>
            {items.map((p) => (
                <Image
                    key={p.alt}
                    src={p.src}
                    alt={p.alt}
                    width={p.w}
                    height={p.h}
                    className={`${p.cls} object-contain`}
                />
            ))}
        </div>
    );
}

export function Footer({ locale, dict }: { locale: Locale; dict: FooterDict }) {
    // Destination & tour names are proper nouns - not translated, only the URL is localized.
    const exploreLinks = [
        { label: 'Curaçao', href: '/curacao' },
        { label: dict.links.boatTours, href: '/curacao/boat-tours' },
        { label: dict.links.buggyTours, href: '/curacao/buggy-tours' },
        { label: dict.links.sunsetCruises, href: '/curacao/sunset-cruises' },
        { label: 'Klein Curaçao', href: '/curacao/klein-curacao' },
    ];
    const supportLinks = [
        { label: dict.links.help, href: '/help' },
        { label: dict.links.contact, href: '/contact' },
    ];
    const workLinks = [
        { label: dict.links.listTour, href: '/list-your-tour' },
        { label: dict.links.affiliate, href: '/affiliate' },
    ];
    const legalLinks = [
        { label: dict.links.privacy, href: '/privacy' },
        { label: dict.links.cookies, href: '/cookies' },
        { label: dict.links.terms, href: '/terms' },
        { label: dict.links.cancellation, href: '/cancellation' },
        { label: dict.links.legalNotice, href: '/legal-notice' },
    ];

    return (
        <footer className='bg-it-ink text-it-white'>
            <div className='it-container pt-9 pb-5 lg:pt-32.5 lg:pb-3'>
                <div className='flex flex-col gap-14 lg:gap-27.5'>
                    {/* ── Top section ──
                        Desktop uses justify-between (which naturally yields the ~110px
                        Figma gaps at 1440); only a small min-gap overrides the mobile
                        gap-16 so the row fits cleanly from 1024 up without shrinking.
                        Reveal = the sitewide scroll-in (footer is always below fold). */}
                    <Reveal className='flex flex-col gap-16 lg:flex-row lg:justify-between lg:gap-6'>
                        {/* Brand + Explore - paired on mobile, flattened into the row on desktop */}
                        <div className='grid grid-cols-2 gap-x-6 lg:contents'>
                            <div className='flex flex-col gap-6 lg:w-52.5 lg:gap-8'>
                                <div className='flex flex-col gap-4 lg:gap-6'>
                                    <Link href={localizeHref(locale, '/')} className='inline-flex'>
                                        <Image
                                            src='/logo/footer-logo.png'
                                            alt='Island Tours'
                                            width={176}
                                            height={131}
                                            className='h-auto w-30.25 object-contain lg:w-44'
                                        />
                                    </Link>
                                    <p className='m-0 text-sm leading-[1.6] tracking-[-0.012em] text-it-footer-muted lg:text-base'>
                                        {dict.tagline}
                                    </p>
                                </div>

                                <div className='flex flex-col gap-2 lg:gap-4'>
                                    <Link
                                        href={localizeHref(locale, '/about')}
                                        className='inline-block w-fit text-sm leading-[1.6] tracking-[-0.012em] text-it-footer-muted no-underline transition-colors duration-300 hover:text-it-white lg:text-base'>
                                        {dict.ourStory}
                                    </Link>
                                    <div className='flex items-center gap-1.25 lg:gap-2'>
                                        {socials.map((s) => (
                                            <Link
                                                key={s.alt}
                                                href={s.href}
                                                aria-label={s.alt}
                                                className='inline-flex'>
                                                <motion.span
                                                    className='inline-flex'
                                                    whileTap={{ scale: 0.9 }}
                                                    transition={springFast}>
                                                    <Image
                                                        src={s.src}
                                                        alt={s.alt}
                                                        width={40}
                                                        height={40}
                                                        className='size-6 lg:size-10'
                                                    />
                                                </motion.span>
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <LinkColumn
                                locale={locale}
                                title={dict.explore}
                                links={exploreLinks}
                                className='lg:whitespace-nowrap'
                            />
                        </div>

                        {/* Support + Work with us - same 2-col grid as Brand|Explore (so
                            "Work with us" lines up under "Explore"), stacked on desktop */}
                        <div className='grid grid-cols-2 gap-x-6 lg:flex lg:flex-col lg:justify-start lg:gap-9.5 lg:whitespace-nowrap'>
                            <LinkColumn locale={locale} title={dict.support} links={supportLinks} />
                            <LinkColumn locale={locale} title={dict.workWithUs} links={workLinks} />
                        </div>

                        <LinkColumn
                            locale={locale}
                            title={dict.legal}
                            links={legalLinks}
                            className='lg:whitespace-nowrap'
                        />

                        {/* Right column: selectors + payments. Full-width on phones, but
                            capped above 480px so the pills + justified payment row don't
                            stretch uglily across tablet widths. */}
                        <div className='flex w-full flex-col gap-8 min-[480px]:max-w-92.5 lg:w-55.25 lg:max-w-none lg:gap-12'>
                            <div className='flex flex-col gap-4'>
                                <LanguageSelector locale={locale} label={dict.language} />
                                <CurrencySelector label={dict.currency} />
                            </div>

                            <div className='flex flex-col gap-8 lg:gap-6'>
                                <div className='flex flex-col gap-4 lg:gap-2.5'>
                                    <PaymentRow items={paymentsRow1} />
                                    <PaymentRow items={paymentsRow2} />
                                </div>

                                <Image
                                    src='/footer/stripe.svg'
                                    alt='Powered by Stripe'
                                    width={114}
                                    height={26}
                                    className='h-6.5 w-28.5'
                                />
                            </div>
                        </div>
                    </Reveal>

                    {/* ── Bottom bar ── */}
                    <Reveal delay={0.35} yOffset={20}>
                        <div className='h-px w-full bg-it-white/50' />
                        <div className='flex flex-col gap-2.5 py-6 lg:flex-row lg:items-center lg:justify-between lg:gap-4'>
                            <div className='flex flex-wrap items-center gap-4 lg:gap-6'>
                                <span className='text-xs leading-[1.6] tracking-[-0.012em] text-it-footer-muted lg:text-base'>
                                    {dict.copyright}
                                </span>
                                <span className='size-1.25 shrink-0 rounded-full bg-it-ink-muted' />
                                <span className='text-xs leading-[1.6] tracking-[-0.012em] text-it-footer-muted lg:text-base'>
                                    {dict.registration}
                                </span>
                            </div>
                            <motion.button
                                type='button'
                                whileTap={{ scale: 0.96 }}
                                transition={springFast}
                                className='w-fit cursor-pointer border-none bg-transparent p-0 text-left text-sm leading-[1.6] tracking-[-0.012em] text-it-footer-muted transition-colors hover:text-it-white lg:text-base'>
                                {dict.manageCookies}
                            </motion.button>
                        </div>
                    </Reveal>
                </div>
            </div>
        </footer>
    );
}
