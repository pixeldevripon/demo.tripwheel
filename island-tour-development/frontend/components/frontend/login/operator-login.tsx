'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MountReveal } from '@/components/frontend/mount-reveal';
import { OtpField } from './code-input';
import {
    ErrorNote,
    Field,
    inputClass,
    primaryBtn,
    quietLink,
    SuccessBlock,
} from './login-ui';

/**
 * Operator portal login card (`/portal`) - the credential step then mandatory
 * 2FA (TOTP, with WhatsApp v1.1 + backup-code fallbacks). Rendered inside the
 * portal shell (`app/(login)/portal/layout.tsx`), which owns the brand panel, so
 * this component is only the right-hand card. The step swap animates via a
 * `MountReveal` keyed by step.
 *
 * SCREENS ONLY: nothing is wired to Better Auth - the credential submit just
 * advances to the 2FA step, and any 6-digit code "verifies".
 */
type Channel = 'totp' | 'wa' | 'backup';

const CODE_ERRORS: Record<Channel, string> = {
    totp: "That code didn't work. Your app makes a new one every 30 seconds, try the newest.",
    wa: "That code didn't work. WhatsApp codes are valid for 10 minutes.",
    backup: "That backup code didn't work. Each one works once.",
};

const CHANNEL_SUBS: Record<Channel, string> = {
    totp: 'The 6-digit code from your authenticator app.',
    wa: 'Code sent to the WhatsApp number ending in 43.',
    backup: 'Enter one of your backup codes.',
};

export function OperatorLogin() {
    const [step, setStep] = useState<1 | 2>(1);
    const [showPw, setShowPw] = useState(false);
    const [channel, setChannel] = useState<Channel>('totp');
    const [code, setCode] = useState('');
    const [codeError, setCodeError] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);

    function switchChannel(next: Channel) {
        setChannel(next);
        setCode('');
        setCodeError(false);
    }

    function backToCredentials() {
        setStep(1);
        setChannel('totp');
        setCode('');
        setCodeError(false);
    }

    function verify(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const raw = code.trim();
        const ok =
            channel === 'backup'
                ? raw.replace(/[^A-Za-z0-9]/g, '').length >= 8
                : raw.replace(/\D/g, '').length >= 6;
        if (!ok) {
            setCodeError(true);
            return;
        }
        setCodeError(false);
        setLoggedIn(true);
    }

    const cardClass =
        'w-full rounded-[16px] border border-it-border bg-it-white px-7 pb-6.5 pt-7.5 shadow-it-md';

    return (
        <MountReveal key={step} className={cardClass}>
            {step === 1 ? (
                <>
                    <h1 className='m-0 font-it-display text-[23px] font-semibold text-it-heading'>
                        Operator portal
                    </h1>
                    <p className='mb-5.5 mt-1.5 text-[14px] text-it-text-muted'>
                        Manage your tours, availability, and bookings.
                    </p>
                    <form onSubmit={(e) => { e.preventDefault(); setStep(2); }}>
                        <Field label='Email' htmlFor='o-email'>
                            <input
                                id='o-email'
                                type='email'
                                name='email'
                                autoComplete='username'
                                inputMode='email'
                                placeholder='you@yourcompany.com'
                                className={inputClass}
                            />
                        </Field>
                        <Field label='Password' htmlFor='o-pw'>
                            <div className='relative'>
                                <input
                                    id='o-pw'
                                    type={showPw ? 'text' : 'password'}
                                    name='password'
                                    autoComplete='current-password'
                                    className={`${inputClass} pr-16`}
                                />
                                <button
                                    type='button'
                                    aria-live='polite'
                                    onClick={() => setShowPw((v) => !v)}
                                    className='absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-it-text-muted transition-colors hover:bg-it-surface hover:text-it-ink'>
                                    {showPw ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </Field>
                        <div className='mb-4.5 mt-0.5 flex items-center justify-end'>
                            <Link href='/portal/forgot' className={quietLink}>
                                Forgot your password?
                            </Link>
                        </div>
                        <button type='submit' className={primaryBtn}>
                            Log in
                        </button>
                    </form>

                    <div className='mt-5 flex flex-col items-center gap-2.5'>
                        <Link href='/apply' className={quietLink}>
                            New here? Apply to list your tours &rarr;
                        </Link>
                        <Link href='/bookings' className={quietLink}>
                            Looking for your booking? Go to island.tours/bookings &rarr;
                        </Link>
                    </div>
                </>
            ) : loggedIn ? (
                <SuccessBlock
                    title='Logged in.'
                    body='The portal opens on the availability screen with one-tap Close today.'
                />
            ) : (
                <>
                    <button
                        type='button'
                        onClick={backToCredentials}
                        className='mb-3.5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-it-text-muted transition-colors hover:text-it-ink'>
                        <ArrowLeft className='size-3.5' strokeWidth={1.5} />
                        Back
                    </button>
                    <h1 className='m-0 font-it-display text-[23px] font-semibold text-it-heading'>
                        Enter your code
                    </h1>
                    <p className='mb-4 mt-1.5 text-[14px] text-it-text-muted'>
                        {CHANNEL_SUBS[channel]}
                    </p>

                    {codeError && <ErrorNote>{CODE_ERRORS[channel]}</ErrorNote>}

                    <form onSubmit={verify} noValidate>
                        <div className='mb-3 text-center text-[13px] font-semibold text-it-heading'>
                            {channel === 'backup' ? 'Backup code' : '6-digit code'}
                        </div>
                        {channel === 'backup' ? (
                            <input
                                id='o-code'
                                type='text'
                                name='code'
                                autoComplete='one-time-code'
                                autoCapitalize='characters'
                                spellCheck={false}
                                maxLength={14}
                                value={code}
                                onChange={(e) => setCode(e.target.value.toUpperCase())}
                                placeholder='Enter a backup code'
                                className={`${inputClass} text-center tracking-[0.15em] uppercase placeholder:tracking-normal placeholder:normal-case`}
                            />
                        ) : (
                            <OtpField value={code} onChange={setCode} />
                        )}
                        <label className='my-4 flex items-center justify-center gap-2.25 text-[13.5px] text-it-text-muted'>
                            <input type='checkbox' className='size-4 accent-it-primary' />
                            Remember this device for 30 days
                        </label>
                        <button type='submit' className={primaryBtn}>
                            Verify
                        </button>
                    </form>

                    <div className='mt-4 flex flex-col items-center gap-2.25'>
                        <button
                            type='button'
                            onClick={() => switchChannel('wa')}
                            className={quietLink}>
                            Send the code to WhatsApp instead
                        </button>
                        <button
                            type='button'
                            onClick={() => switchChannel('backup')}
                            className={quietLink}>
                            Use a backup code
                        </button>
                    </div>
                </>
            )}
        </MountReveal>
    );
}
