'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, LogOut, UserRound } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import { useTravellerIdentity } from '@/hooks/use-traveller-identity';
import { localizeHref, type Locale } from '@/lib/constants/locales';
import { signOutTraveller } from '@/lib/traveler-booking';

import {
    dropdownItemMotion,
    dropdownMotion,
    iconPress,
} from './lib/navbar.constants';
import type { NavDict } from './lib/navbar.types';
import { useClickOutside } from './lib/use-click-outside';

/**
 * The path with its locale prefix removed, so every route test below can be
 * written once. The thank-you route is served LOCALE-LESS through the proxy
 * rewrite, so both shapes have to fall out of this the same way.
 */
function stripLocale(pathname: string, locale: Locale): string {
    if (pathname === `/${locale}`) return '/';
    return pathname.startsWith(`/${locale}/`)
        ? pathname.slice(locale.length + 1)
        : pathname;
}

/** The account area - what the "Accounts" item points at. */
const ACCOUNT_PATH = /^\/traveller(\/|$)/;

/**
 * Everything that is "a booking": the lookup door, a booking's own thank-you
 * page, and its cancellation page. The menu item is one entry, so all three
 * light it up - a traveller reading their confirmation is inside Bookings.
 */
const BOOKINGS_PATH = /^\/(bookings(\/|$)|cancel\/|[a-z0-9-]+\/thank-you\/)/;

/**
 * Pages that only exist for a signed-in traveller. Signing out on one of these
 * has to move the traveller off it - otherwise "log out" leaves them staring at
 * their own bookings until something else triggers a navigation. Everywhere
 * else, signing out is a chrome change and the page they were reading stays.
 */
function isAccountGated(path: string): boolean {
    return ACCOUNT_PATH.test(path) || BOOKINGS_PATH.test(path);
}

/** Active row: primary ink and medium weight, matching the locale menu. */
const ROW =
    'flex w-full items-center gap-2.5 px-5 py-3 text-[13px] no-underline transition-colors duration-200 hover:bg-it-surface tracking-[-0.012em]';
const ROW_ACTIVE = 'text-it-primary font-medium tracking-[-0.012em]';
const ROW_IDLE = '';

/**
 * Account entry in the navbar - a traveller surface driven ONLY by the
 * `it.travelerBooking` / `it.travellerAccount` cookies (no Better Auth session
 * on the public site). With no cookie it links to /traveller (the account
 * door); signed in it opens a small menu showing the email, the account area,
 * the booking lookup, and a log-out.
 *
 * The identity comes from a subscribed store rather than a mount effect, so it
 * is correct on the first render after hydration AND updates the moment the
 * traveller signs in or out anywhere else in the session.
 */
export function AccountMenu({
    locale,
    dict,
}: {
    locale: Locale;
    dict: NavDict;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [open, setOpen] = useState(false);
    const [signingOut, setSigningOut] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Stable identity, or the click-outside effect would tear down and re-attach
    // its document listener on every single render of the header.
    const close = useCallback(() => setOpen(false), []);
    useClickOutside(ref, close, open);

    const accountHref = localizeHref(locale, '/traveller');

    const path = stripLocale(pathname, locale);
    const accountActive = ACCOUNT_PATH.test(path);

    // TWO ways to be signed in, and the menu must recognise both: a `/bookings`
    // pair lookup (which saves a booking record) or the account door's OTP
    // login (which saves only the email). Neither cookie authorizes anything -
    // the real credential is HttpOnly and unreadable here.
    const { email: identityEmail } = useTravellerIdentity();

    async function handleLogout() {
        if (signingOut) return;
        setSigningOut(true);
        // Awaited, so the HttpOnly session is gone BEFORE anything re-renders
        // from the server - a fire-and-forget delete used to race the refresh
        // and hand back a still-signed-in page.
        await signOutTraveller();
        setOpen(false);
        setSigningOut(false);
        if (isAccountGated(path)) {
            // BOTH, and `refresh` is the one that matters for privacy.
            // `replace` navigates but leaves the already-fetched
            // `/{locale}/traveller` flight payload - the full booking and
            // payment list - sitting in the in-memory router cache, where Back
            // renders it again with no credential. Only `refresh()` clears it.
            router.replace(localizeHref(locale, '/'));
            router.refresh();
        } else {
            router.refresh();
        }
    }

    const profileIcon = (
        <Image
            src='/icons/nav-profile.svg'
            alt=''
            width={24}
            height={24}
            className='size-5'
        />
    );

    if (!identityEmail) {
        return (
            <Link
                href={accountHref}
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
                    /* The shared navbar dropdown motion, same as the locale and
                       category menus: a spring open and a short clean fade out.
                       The hand-rolled cross-fade this replaced took ~330ms to
                       dismiss against ~40ms to open, which is what made the
                       menu feel heavy. */
                    <motion.div
                        {...dropdownMotion}
                        className='absolute top-[calc(100%+18px)] right-0 w-64 origin-top-right bg-it-white border border-it-border-subtle rounded-it-lg shadow-it-lg overflow-hidden z-50'>
                        {/* The email the traveller signed in with - the only
                            identity the public site has. */}
                        <motion.div
                            {...dropdownItemMotion}
                            className='flex items-center gap-3 px-5 py-4'>
                            <span className='flex size-9 shrink-0 items-center justify-center rounded-it-full bg-it-surface text-[13px] font-medium uppercase'>
                                {identityEmail.trim().charAt(0)}
                            </span>
                            <span className='min-w-0'>
                                <span className='block text-[13px] leading-[1.4] font-medium text-it-heading truncate tracking-[-0.012em]'>
                                    {identityEmail}
                                </span>
                                <span className='block text-[11.5px] leading-[1.6] text-it-text-muted truncate tracking-[-0.012em]'>
                                    {dict.account}
                                </span>
                            </span>
                        </motion.div>

                        {/* The account area: every booking and payment, behind
                            its own emailed-code sign-in. `prefetch={false}` on
                            both links - these are per-traveller pages that
                            cannot be cached and are never worth speculatively
                            fetching just because a menu opened. */}
                        <motion.div
                            {...dropdownItemMotion}
                            className='border-t border-it-border'>
                            <Link
                                href={accountHref}
                                prefetch={false}
                                onClick={close}
                                aria-current={
                                    accountActive ? 'page' : undefined
                                }
                                className={`${ROW} ${accountActive ? ROW_ACTIVE : ROW_IDLE}`}>
                                <UserRound
                                    size={16}
                                    strokeWidth={1.5}
                                    className={`shrink-0 ${accountActive ? 'text-it-primary tracking-[-0.012em]' : 'text-it-text-muted tracking-[-0.012em]'}`}
                                />
                                {dict.myAccount}
                            </Link>
                        </motion.div>

                        {/* The `/bookings` lookup is deliberately NOT here.
                            It moved to the footer as "Track your booking",
                            because it is the door for someone who has a
                            reference and no account - and this menu only exists
                            once they are signed in, where the account area above
                            already shows every booking. Offering both put the
                            weaker lookup next to the stronger view of the same
                            thing. The footer reaches the people it is actually
                            for, on every page, signed in or not. */}
                        <motion.div
                            {...dropdownItemMotion}
                            className='border-t border-it-border'>
                            <button
                                onClick={() => void handleLogout()}
                                disabled={signingOut}
                                aria-busy={signingOut}
                                className={`${ROW} ${ROW_IDLE} cursor-pointer border-none bg-transparent text-left disabled:cursor-wait disabled:opacity-60`}>
                                {/* Signing out is a network round trip. Without
                                    a pending state the row looks inert for the
                                    whole of it and travellers click again. */}
                                {signingOut ? (
                                    <Loader2
                                        size={16}
                                        strokeWidth={1.5}
                                        className='shrink-0 animate-spin text-it-text-muted tracking-[-0.012em]'
                                    />
                                ) : (
                                    <LogOut
                                        size={16}
                                        strokeWidth={1.5}
                                        className='shrink-0 text-it-text-muted tracking-[-0.012em]'
                                    />
                                )}
                                {dict.logout}
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

