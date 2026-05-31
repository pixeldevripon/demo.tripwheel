import Image from 'next/image';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';

const linkColumns = [
    {
        title: 'Explore',
        links: [
            { label: 'Curaçao', href: '/curacao' },
            { label: 'Aruba', href: '/aruba' },
            { label: 'Sint Maarten', href: '/sint-maarten' },
        ],
    },
    {
        title: 'Legal',
        links: [
            { label: 'Privacy Policy', href: '/privacy' },
            { label: 'Terms of Service', href: '/terms' },
            { label: 'Cookie Policy', href: '/cookies' },
        ],
    },
    {
        title: 'Support',
        links: [
            { label: 'Help Center', href: '/help' },
            { label: 'Contact', href: '/contact' },
        ],
    },
];

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

const trustItems = ['Secure booking', 'Free cancellation on most tours', 'Local experts'];

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
            <button className='flex items-center justify-between gap-2 w-full bg-it-white rounded-it-full px-4 py-3 cursor-pointer border-none'>
                <span className='flex items-center gap-2'>
                    {icon}
                    <span className='text-base text-it-ink'>{value}</span>
                </span>
                <ChevronDown size={20} strokeWidth={1.5} className='text-it-ink' />
            </button>
        </div>
    );
}

export function Footer() {
    return (
        <footer className='bg-it-ink text-it-white'>
            <div className='it-container py-20'>
                {/* ── Top section: 5 columns ── */}
                <div className='flex flex-col lg:flex-row lg:justify-between gap-12 lg:gap-8'>

                    {/* Brand column */}
                    <div className='flex flex-col gap-6 max-w-52.5'>
                        <Image
                            src='/logo/footer-logo.png'
                            alt='Island Tours'
                            width={198}
                            height={147}
                            className='object-contain w-40 h-auto'
                        />
                        <p className='m-0 text-base text-it-white/55 leading-snug'>
                            Island Tours. Built by Islanders. Copyright ©2026
                        </p>
                        <div className='flex items-center gap-3'>
                            {socials.map((s) => (
                                <Link key={s.alt} href={s.href} aria-label={s.alt} className='inline-flex'>
                                    <Image src={s.src} alt={s.alt} width={24} height={24} className='size-6' />
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Link columns */}
                    {linkColumns.map((col) => (
                        <div key={col.title} className='flex flex-col gap-8'>
                            <h3 className='m-0 text-xl font-medium text-it-white'>{col.title}</h3>
                            <ul className='list-none m-0 p-0 flex flex-col gap-3'>
                                {col.links.map((link) => (
                                    <li key={link.label}>
                                        <Link
                                            href={link.href}
                                            className='text-base text-it-white/55 hover:text-it-white no-underline transition-colors'
                                        >
                                            {link.label}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    {/* Right column: selectors + payments */}
                    <div className='flex flex-col gap-8 w-full max-w-73.5'>
                        <Selector
                            label='Language'
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
                            label='Currency'
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
                                <div key={i} className='flex items-center justify-between'>
                                    {row.map((p) => (
                                        <Image
                                            key={p.alt}
                                            src={p.src}
                                            alt={p.alt}
                                            width={74}
                                            height={41}
                                            className='h-10 w-auto'
                                        />
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
                                <span className='text-base text-it-white/55'>{item}</span>
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
