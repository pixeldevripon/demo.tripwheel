'use client';

import { signIn } from '@/lib/auth-client';
import { MountReveal } from '@/components/frontend/mount-reveal';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
    Field,
    inputClass,
    primaryBtn,
    quietLink,
    ErrorNote,
} from './login-ui';
// import OperatorTwoFactor from './operator-two-factor'; // 2FA — uncomment when enabled

/**
 * Operator portal login card (`/portal`) — credential step.
 * Rendered inside the portal shell (`app/(login)/portal/layout.tsx`), which
 * owns the brand panel, so this component is only the right-hand card.
 *
 * 2FA (TOTP / backup codes) is wired in `operator-two-factor.tsx` but
 * commented out below — uncomment when the backend supports it.
 */

// 2FA types — kept for when the flow is re-enabled
export type Channel = 'totp' | 'wa' | 'backup';

export const CODE_ERRORS: Record<Channel, string> = {
    totp: "That code didn't work. Your app makes a new one every 30 seconds, try the newest.",
    wa: "That code didn't work. WhatsApp codes are valid for 10 minutes.",
    backup: "That backup code didn't work. Each one works once.",
};

export const CHANNEL_SUBS: Record<Channel, string> = {
    totp: 'The 6-digit code from your authenticator app.',
    wa: 'Code sent to the WhatsApp number ending in 43.',
    backup: 'Enter one of your backup codes.',
};

export function OperatorLogin() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // ── 2FA state — uncomment when 2FA is enabled ──────────────────────────
    // const [step, setStep] = useState<1 | 2>(1);
    // const [channel, setChannel] = useState<Channel>('totp');
    // const [code, setCode] = useState('');
    // const [codeError, setCodeError] = useState(false);
    //
    // function switchChannel(next: Channel) {
    //     setChannel(next);
    //     setCode('');
    //     setCodeError(false);
    // }
    // function backToCredentials() {
    //     setStep(1);
    //     setChannel('totp');
    //     setCode('');
    //     setCodeError(false);
    // }
    // function verify(e: React.FormEvent<HTMLFormElement>) {
    //     e.preventDefault();
    //     const raw = code.trim();
    //     const ok =
    //         channel === 'backup'
    //             ? raw.replace(/[^A-Za-z0-9]/g, '').length >= 8
    //             : raw.replace(/\D/g, '').length >= 6;
    //     if (!ok) { setCodeError(true); return; }
    //     setCodeError(false);
    //     router.push('/dashboard');
    //     router.refresh();
    // }
    // ──────────────────────────────────────────────────────────────────────

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { error: authError } = await signIn.email({ email, password });
            if (authError) {
                setError(authError.message || 'Invalid email or password.');
            } else {
                // When 2FA is enabled: setStep(2) instead of redirect
                router.push('/dashboard');
                router.refresh();
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }

    const cardClass =
        'w-full rounded-[16px] border border-it-border bg-it-white px-7 pb-6.5 pt-7.5 shadow-it-md';

    return (
        <MountReveal className={cardClass}>
            <h1 className='m-0 font-it-display text-[23px] font-semibold text-it-heading'>
                Operator portal
            </h1>
            <p className='mb-5.5 mt-1.5 text-[14px] text-it-text-muted'>
                Manage your tours, availability, and bookings.
            </p>

            <form onSubmit={handleSubmit}>
                <Field label='Email' htmlFor='o-email'>
                    <input
                        id='o-email'
                        type='email'
                        name='email'
                        autoComplete='username'
                        inputMode='email'
                        placeholder='you@yourcompany.com'
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
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
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className={`${inputClass} pr-16`}
                        />
                        <button
                            type='button'
                            aria-live='polite'
                            onClick={() => setShowPw(v => !v)}
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

                {error && <ErrorNote>{error}</ErrorNote>}

                <button
                    type='submit'
                    disabled={loading}
                    className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                    {loading ? 'Signing in…' : 'Log in'}
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

            {/*
             * ── 2FA step — uncomment block + setStep(2) call above when enabled ──
             * {step === 2 && !loggedIn && (
             *     <OperatorTwoFactor
             *         backToCredentials={backToCredentials}
             *         switchChannel={switchChannel}
             *         verify={verify}
             *         channel={channel}
             *         code={code}
             *         codeError={codeError}
             *         setChannel={setChannel}
             *         setCode={setCode}
             *     />
             * )}
             */}
        </MountReveal>
    );
}

