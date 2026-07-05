'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { MountReveal } from '@/components/frontend/mount-reveal';
import { LoginLocaleSwitch } from './login-locale-switch';
import {
    ErrorNote,
    Field,
    inputClass,
    primaryBtn,
    quietLink,
    SuccessBlock,
} from './login-ui';

/**
 * Traveler surface `/bookings` (spec 2). Email + booking-reference pair login -
 * no passwords, no sign-up. Takeover chrome (checkout family): logo, WhatsApp,
 * language switch, minimal footer. Two panels: the login card and the
 * lost-reference recovery card.
 *
 * SCREENS ONLY: submit is mocked (no backend) so the working auth is untouched.
 * First submit shows the enumeration-proof generic error; second "logs in".
 */
export function TravelerLogin() {
    const [panel, setPanel] = useState<'login' | 'lost'>('login');
    const [tried, setTried] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);
    const [recoverySent, setRecoverySent] = useState(false);

    function handleLogin(e: React.FormEvent) {
        e.preventDefault();
        if (!tried) {
            setTried(true);
            return;
        }
        setLoggedIn(true);
    }

    return (
        <div className='flex min-h-screen flex-col bg-it-bg'>
            {/* ── Takeover top bar ─────────────────────────────────────────── */}
            <header className='flex items-center justify-between px-7 py-5'>
                <Link href='/' aria-label='Island Tours home' className='shrink-0'>
                    <Image
                        src='/logo/logo.png'
                        alt='Island Tours'
                        width={68}
                        height={50}
                        priority
                        className='h-11 w-auto object-contain'
                    />
                </Link>
                <div className='flex items-center gap-2'>
                    <LoginLocaleSwitch />
                    <a
                        href='#'
                        className='flex items-center gap-2 rounded-full bg-it-green px-3.5 py-2 text-[14px] font-semibold text-it-white transition-colors hover:bg-it-green/90'>
                        <Image
                            src='/icons/whatsapp.svg'
                            alt=''
                            width={24}
                            height={24}
                            className='size-4.5 shrink-0'
                        />
                        WhatsApp us
                    </a>
                </div>
            </header>

            {/* ── Centered card ────────────────────────────────────────────── */}
            <main className='flex flex-1 justify-center px-5 pb-10 pt-[5vh]'>
                <div className='h-fit w-full max-w-110 rounded-[16px] border border-it-border bg-it-white px-7.5 pb-7 pt-8 shadow-it-md'>
                    <MountReveal
                        key={panel === 'login' ? (loggedIn ? 'success' : 'login') : 'lost'}>
                    {panel === 'login' ? (
                        loggedIn ? (
                            <SuccessBlock
                                title='Logged in.'
                                body='The bookings list opens here: bookings, invoices, and your saved tours.'
                            />
                        ) : (
                            <>
                                <h1 className='m-0 font-it-display text-[26px] font-semibold tracking-[-0.01em] text-it-heading'>
                                    Your bookings
                                </h1>
                                <p className='mb-6 mt-2 text-[14.5px] text-it-text-muted'>
                                    Log in with the email you booked with and your booking reference.
                                </p>

                                {tried && (
                                    <ErrorNote>
                                        That email and reference don&apos;t match. Check your
                                        confirmation email, or{' '}
                                        <a href='#' className='underline'>
                                            WhatsApp us
                                        </a>{' '}
                                        and we&apos;ll fix it.
                                    </ErrorNote>
                                )}

                                <form onSubmit={handleLogin}>
                                    <Field label='Email' htmlFor='t-email'>
                                        <input
                                            id='t-email'
                                            type='email'
                                            name='email'
                                            autoComplete='email'
                                            inputMode='email'
                                            placeholder='you@example.com'
                                            className={inputClass}
                                        />
                                    </Field>
                                    <Field label='Booking reference' htmlFor='t-ref'>
                                        <input
                                            id='t-ref'
                                            type='text'
                                            name='reference'
                                            autoComplete='off'
                                            autoCapitalize='characters'
                                            spellCheck={false}
                                            placeholder='IT-2026-K3M9P'
                                            className={inputClass}
                                        />
                                        <p className='mt-1.5 text-[12.5px] text-it-text-muted'>
                                            Top of your confirmation email.
                                        </p>
                                    </Field>
                                    <button type='submit' className={primaryBtn}>
                                        Show my bookings
                                    </button>
                                </form>

                                <div className='mt-4.5 flex justify-center'>
                                    <button
                                        type='button'
                                        onClick={() => setPanel('lost')}
                                        className={quietLink}>
                                        Lost your reference?
                                    </button>
                                </div>
                            </>
                        )
                    ) : (
                        <>
                            <button
                                type='button'
                                onClick={() => setPanel('login')}
                                className='mb-3.5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-it-text-muted transition-colors hover:text-it-ink'>
                                <ArrowLeft className='size-3.5' strokeWidth={1.5} />
                                Back
                            </button>
                            <h1 className='m-0 font-it-display text-[26px] font-semibold tracking-[-0.01em] text-it-heading'>
                                We&apos;ll email it to you
                            </h1>
                            <p className='mb-6 mt-2 text-[14.5px] text-it-text-muted'>
                                Enter the email you booked with.
                            </p>
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    setRecoverySent(true);
                                }}>
                                <Field label='Email' htmlFor='t-lost-email'>
                                    <input
                                        id='t-lost-email'
                                        type='email'
                                        name='email'
                                        autoComplete='email'
                                        inputMode='email'
                                        placeholder='you@example.com'
                                        className={inputClass}
                                    />
                                </Field>
                                <button type='submit' className={primaryBtn}>
                                    Email me my reference
                                </button>
                            </form>
                            {recoverySent && (
                                <div className='mt-4 flex gap-2 rounded-[10px] bg-it-surface px-3.5 py-2.5 text-[13px] text-it-text-muted'>
                                    <Mail className='mt-0.5 size-4 shrink-0' strokeWidth={1.5} />
                                    If that email has bookings with us, the reference is on its way.
                                </div>
                            )}
                        </>
                    )}
                    </MountReveal>
                </div>
            </main>

            {/* ── Wrong-door cross-link ────────────────────────────────────── */}
            <div className='flex justify-center'>
                <Link href='/portal' className={quietLink}>
                    Tour operator? Log in to the operator portal &rarr;
                </Link>
            </div>

            {/* ── Minimal footer ───────────────────────────────────────────── */}
            <footer className='flex flex-col items-center gap-2 px-5 pb-8.5 pt-6.5 text-[12.5px] text-it-text-muted'>
                <div className='font-it-display text-[15px] font-bold text-it-ink'>
                    Built by Islanders.
                </div>
                <div className='flex gap-3.5'>
                    <a href='#' className='transition-colors hover:text-it-primary'>
                        Terms
                    </a>
                    <a href='#' className='transition-colors hover:text-it-primary'>
                        Privacy Policy
                    </a>
                    <a href='#' className='transition-colors hover:text-it-primary'>
                        Help
                    </a>
                </div>
            </footer>
        </div>
    );
}

