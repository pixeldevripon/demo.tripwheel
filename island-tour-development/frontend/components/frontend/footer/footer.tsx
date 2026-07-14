import Image from 'next/image';
import Link from 'next/link';
import { MotionButton, MotionSpan } from '@/components/frontend/motion-primitives';
import { Reveal } from '@/components/frontend/reveal';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { springPop } from '@/lib/motion';
import { CurrencySelector, LanguageSelector } from './footer-selectors';

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
                                                <MotionSpan
                                                    className='inline-flex'
                                                    whileTap={{ scale: 0.9 }}
                                                    transition={springPop}>
                                                    <Image
                                                        src={s.src}
                                                        alt={s.alt}
                                                        width={40}
                                                        height={40}
                                                        className='size-6 lg:size-10'
                                                    />
                                                </MotionSpan>
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
                            <MotionButton
                                type='button'
                                
                                transition={springPop}
                                className='w-fit cursor-pointer border-none bg-transparent p-0 text-left text-sm leading-[1.6] tracking-[-0.012em] text-it-footer-muted transition-colors hover:text-it-white lg:text-base'>
                                {dict.manageCookies}
                            </MotionButton>
                        </div>
                    </Reveal>
                </div>
            </div>
        </footer>
    );
}
