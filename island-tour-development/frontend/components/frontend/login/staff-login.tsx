'use client';

import Image from 'next/image';
import { useState } from 'react';
import AuthForm from './auth-form';

/**
 * Staff surface `/staff` (spec 4). Google Workspace SSO only - no app-level
 * passwords. Dark, near-monochrome, linked from nowhere. The `hd` claim +
 * allowlist are verified server-side; the denied state is specific (safe here -
 * Google has already proven identity).
 *
 * SCREENS ONLY: the button does not start a real OAuth flow. First click shows
 * the denied state, second "logs in" - a faithful demo of the two outcomes.
 */
export function StaffLogin() {
    const [tried, setTried] = useState(false);
    /*   const [loggedIn, setLoggedIn] = useState(false); */

    /*     function handleGoogle() {
        if (!tried) {
            setTried(true);
            return;
        }
        setLoggedIn(true);
    } */

    return (
        <div className='flex min-h-screen flex-col items-center justify-center bg-it-ink px-6'>
            <Image
                src='/logo/footer-logo.png'
                alt='Island Tours'
                width={176}
                height={131}
                priority
                className='mb-6.5 h-auto w-32 object-contain'
            />

            <div className='w-full max-w-95 rounded-[16px] bg-it-white px-7 pb-6.5 pt-7.5 shadow-[0_20px_60px_rgba(0,0,0,0.4)]'>
                <h1 className='mb-5 text-center font-it-display text-[19px] font-semibold text-it-heading'>
                    Staff access
                </h1>

                {/*      <MountReveal key={loggedIn ? 'success' : 'signin'}>
                {loggedIn ? (
                    <div className='py-1'>
                        <div className='mx-auto mb-3.5 flex size-13 items-center justify-center rounded-full bg-it-green-subtle'>
                            <Check className='size-6 text-it-green-fg' strokeWidth={2} />
                        </div>
                        <strong className='text-it-heading'>Logged in.</strong>
                        <p className='mt-1.5 text-[13px] text-it-text-muted'>
                            Role and domain checked server-side, session 12 hours.
                        </p>
                        <span className='mt-2.5 inline-block rounded-[6px] border border-dashed border-it-border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-[0.06em] text-it-text-muted'>
                            Mockup endpoint
                        </span>
                    </div>
                ) : (
                    <>
                        <button
                            type='button'
                            onClick={handleGoogle}
                            className='flex w-full items-center justify-center gap-2 rounded-full border border-it-border bg-it-white px-5 py-3.25 text-[15px] font-semibold text-it-ink transition-shadow hover:shadow-it-sm'>
                            <GoogleMark />
                            Continue with Google
                        </button>

                        {tried && (
                            <div
                                role='alert'
                                className='mt-4 flex items-start gap-2 rounded-[10px] border border-red-200 bg-red-50 px-3.25 py-2.5 text-left text-[13px] text-red-700'>
                                <CircleAlert className='mt-0.5 size-4 shrink-0' strokeWidth={1.75} />
                                <span>
                                    This Google account doesn&apos;t have staff access. Ask an admin
                                    to add you.
                                </span>
                            </div>
                        )}
                    </>
                )}
                </MountReveal> */}
                <AuthForm />
                <p className='mt-4 text-[12px] leading-[1.5] text-it-text-muted'>
                    Island Tours staff only. Every login and action is logged.
                </p>
            </div>

            <p className='mt-5.5 max-w-85 text-center text-[12px] text-white/65'>
                admin.island.tours &middot; linked from nowhere, noindex,
                authorization always server-side
            </p>
        </div>
    );
}

/** Official Google "G" brand mark - kept multi-color (not recolourable). */
function GoogleMark() {
    return (
        <svg
            className='size-4.5 shrink-0'
            viewBox='0 0 48 48'
            aria-hidden='true'>
            <path
                fill='#EA4335'
                d='M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.7 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.2C12.4 13.6 17.7 9.5 24 9.5z'
            />
            <path
                fill='#4285F4'
                d='M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.5-4.1 7-10.2 7-17.6z'
            />
            <path
                fill='#FBBC05'
                d='M10.5 28.6a14.5 14.5 0 0 1 0-9.2l-7.9-6.2a24 24 0 0 0 0 21.6l7.9-6.2z'
            />
            <path
                fill='#34A853'
                d='M24 48c6.2 0 11.4-2 15.2-5.6l-7.6-5.9c-2.1 1.4-4.7 2.3-7.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.2C6.5 42.6 14.6 48 24 48z'
            />
        </svg>
    );
}


