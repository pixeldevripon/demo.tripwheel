import {
    Linkedin02Icon,
    NewTwitterIcon,
    YoutubeIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Link from 'next/link';

import { Reveal } from '@/components/marketing/reveal';


const LINK_COLUMNS: { title: string; links: string[] }[] = [
    {
        title: 'Platform',
        links: ['Overview', 'Security', 'Pricing'],
    },
    {
        title: 'Use Cases',
        links: [
            'Bookings & Itineraries',
            'Payments & Invoicing',
            'Automation & Workflows',
            'Supplier Management',
            'Reporting & Forecasts',
        ],
    },
    {
        title: 'Industries',
        links: ['Tour Operators', 'Travel Agencies', 'DMCs'],
    },
    {
        title: 'Resources',
        links: ['Blog', 'Guides', 'Free Tools', 'Webinars'],
    },
    {
        title: 'Company',
        links: ['About Us', 'Community', 'Careers', 'Legal'],
    },
];

/**
 * Closing CTA + footer (Clarasight ref): centred imperative headline and
 * accent pill on the lavender field, five hairline link columns with
 * compliance badges, legal row, and the giant translucent wordmark pinned to
 * the very bottom.
 */
export function MarketingFooter() {
    return (
        <footer className='mk-footer-bg border-t border-mk-line'>
            <Reveal className='mx-auto flex max-w-2xl flex-col items-center px-6 py-mk-section text-center'>
                <h2 className='text-mk-title font-medium text-mk-ink md:text-mk-display'>
                    Grow revenue. Delight travelers.
                    <br />
                    Recover time.
                </h2>
                <p className='mt-6 max-w-md text-sm leading-relaxed text-mk-body'>
                    See how TripWheel turns fragmented agency operations into
                    actionable intelligence to improve revenue, efficiency,
                    control and customer experience.
                </p>
                <Link
                    href='/login'
                    className='mt-8 inline-flex h-11 items-center rounded-full bg-mk-accent px-6 text-sm font-medium text-white transition-colors hover:bg-mk-accent-hover'>
                    Start free
                </Link>
            </Reveal>

            <div className='px-6 pb-12 md:px-12'>
                <div className='grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-6'>
                    {LINK_COLUMNS.map(column => (
                        <div key={column.title}>
                            <h3 className='text-xs text-mk-faint'>
                                {column.title}
                            </h3>
                            <ul className='mt-4 flex flex-col gap-2.5'>
                                {column.links.map(link => (
                                    <li key={link}>
                                        <a
                                            href='#home'
                                            className='text-sm text-mk-ink transition-colors hover:text-mk-accent'>
                                            {link}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}

                    <div className='flex items-start justify-start gap-3 lg:justify-end'>
                        <span className='inline-flex size-9 items-center justify-center rounded-full border border-mk-line-strong text-2xs font-bold text-mk-body'>
                            ISO
                        </span>
                        <span className='inline-flex size-9 items-center justify-center rounded-full border border-dashed border-mk-line-strong text-2xs font-bold text-mk-body'>
                            GDPR
                        </span>
                    </div>
                </div>

                <div className='mt-16 flex flex-col gap-4 border-t border-mk-line-strong pt-6 md:flex-row md:items-center md:justify-between'>
                    <p className='text-xs text-mk-faint'>
                        Get an AI summary of TripWheel
                    </p>
                    <div className='flex items-center gap-6'>
                        <p className='text-xs text-mk-faint'>
                            &copy; 2026 TripWheel. All rights reserved.
                        </p>
                        <div className='flex items-center gap-3'>
                            <a
                                href='#home'
                                aria-label='TripWheel on LinkedIn'
                                className='text-mk-body transition-colors hover:text-mk-accent'>
                                <HugeiconsIcon
                                    icon={Linkedin02Icon}
                                    className='size-4'
                                />
                            </a>
                            <a
                                href='#home'
                                aria-label='TripWheel on X'
                                className='text-mk-body transition-colors hover:text-mk-accent'>
                                <HugeiconsIcon
                                    icon={NewTwitterIcon}
                                    className='size-4'
                                />
                            </a>
                            <a
                                href='#home'
                                aria-label='TripWheel on YouTube'
                                className='text-mk-body transition-colors hover:text-mk-accent'>
                                <HugeiconsIcon
                                    icon={YoutubeIcon}
                                    className='size-4'
                                />
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div
                className='mk-watermark mx-auto h-16 w-full max-w-5xl px-6 md:h-32'
                aria-hidden='true'
            />
        </footer>
    );
}
