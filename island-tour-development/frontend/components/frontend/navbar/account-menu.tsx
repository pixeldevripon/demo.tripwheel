'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { LogOut, Ticket } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import { localizeHref, type Locale } from '@/lib/constants/locales';
import { crossFade } from '@/lib/motion';
import {
    clearTravelerBooking,
    readTravelerBooking,
    type TravelerBooking,
} from '@/lib/traveler-booking';

import { iconPress } from './lib/navbar.constants';
import type { NavDict } from './lib/navbar.types';
import { useClickOutside } from './lib/use-click-outside';

/**
 * Account entry in the navbar - a traveller surface driven ONLY by the
 * `it.travelerBooking` cookie (no Better Auth session on the public site).
 * With no cookie it links to /bookings (the email + booking-ref lookup);
 * after a successful lookup it opens a small menu showing the email the
 * traveller searched with, a deep-link to their booking's thank-you page,
 * and a log-out that simply clears the cookie.
 */
export function AccountMenu({
    locale,
    dict,
}: {
    locale: Locale;
    dict: NavDict;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);
    useClickOutside(ref, () => setOpen(false), open);
    const bookingsHref = localizeHref(locale, '/bookings');

    // Read after mount (SSR has no document); the SSR pass renders the plain
    // lookup link, which is also the no-cookie state.
    const [booking, setBooking] = useState<TravelerBooking | null>(null);
    useEffect(() => {
        setBooking(readTravelerBooking());
    }, []);

    function handleLogout() {
        clearTravelerBooking();
        setBooking(null);
        setOpen(false);
    }

    const profileIcon = (
        <Image
            src='/icons/nav-profile.svg'
            alt=''
            width={24}
            height={24}
            className='size-6'
        />
    );

    if (!booking) {
        return (
            <Link
                href={bookingsHref}
                aria-label={dict.account}
                className='flex items-center no-underline'>
                <motion.span className='inline-flex' {...iconPress}>
                    {profileIcon}
                </motion.span>
            </Link>
        );
    }

    return (
        <div ref={ref} className='relative'>
            <motion.button
                onClick={() => setOpen(v => !v)}
                aria-label={dict.account}
                aria-expanded={open}
                {...iconPress}
                className='flex items-center bg-transparent border-none cursor-pointer p-0'>
                {profileIcon}
            </motion.button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={crossFade}
                        className='absolute top-[calc(100%+18px)] right-0 w-64 origin-top-right bg-it-white border border-it-border rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                        {/* The email the traveller looked their booking up
                            with - the only identity the public site has. */}
                        <div className='flex items-center gap-3 px-5 py-4'>
                            <span className='flex size-9 shrink-0 items-center justify-center rounded-it-full bg-it-surface text-sm font-semibold uppercase text-it-ink'>
                                {booking.email.trim().charAt(0)}
                            </span>
                            <span className='min-w-0'>
                                <span className='block text-sm leading-[1.4] font-medium text-it-ink truncate'>
                                    {booking.email}
                                </span>
                                <span className='block text-xs leading-[1.6] text-it-ink-muted truncate'>
                                    {dict.account}
                                </span>
                            </span>
                        </div>

                        {/* Always the lookup page - it prefills itself from
                            the cookie's saved search data. */}
                        <div className='border-t border-it-border'>
                            <Link
                                href={bookingsHref}
                                onClick={() => setOpen(false)}
                                className='flex w-full items-center gap-2.5 px-5 py-3 text-sm text-it-ink no-underline transition-colors duration-200 hover:bg-it-surface'>
                                <Ticket
                                    size={16}
                                    strokeWidth={1.5}
                                    className='shrink-0 text-it-ink-muted'
                                />
                                {dict.myBookings}
                            </Link>
                        </div>

                        <div className='border-t border-it-border'>
                            <button
                                onClick={handleLogout}
                                className='flex w-full items-center gap-2.5 px-5 py-3 text-left text-sm bg-transparent border-none cursor-pointer transition-colors duration-200 hover:bg-it-surface text-it-ink'>
                                <LogOut
                                    size={16}
                                    strokeWidth={1.5}
                                    className='shrink-0 text-it-ink-muted'
                                />
                                {dict.logout}
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
