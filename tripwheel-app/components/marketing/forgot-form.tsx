'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

/**
 * Forgot-password request (mirrors the dashboard's operator flow, restyled
 * for the marketing surface). Enumeration-proof: the result is always the
 * success note unless the backend is rate-limiting. The reset email links
 * back to this site's /reset page.
 */
export function ForgotForm() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');
        const { error: authError } = await authClient.requestPasswordReset({
            email,
            redirectTo: `${window.location.origin}/reset`,
        });
        setLoading(false);
        if (authError) {
            const message = authError.message?.toLowerCase() ?? '';
            if (message.includes('rate') || message.includes('too many')) {
                setError(
                    'Too many requests. Please wait a moment and try again.'
                );
                return;
            }
        }
        // Always land on the success note (enumeration-proof).
        setSent(true);
    }

    return (
        <div className='mx-auto w-full max-w-sm'>
            <Link href='/' className='flex justify-center'>
                <Image
                    src='/logo/logo-light.svg'
                    alt='TripWheel'
                    width={156}
                    height={30}
                    priority
                />
            </Link>

            <h1 className='mt-8 text-center text-mk-plan font-medium text-mk-ink'>
                Forgot your password?
            </h1>
            <p className='mt-3 text-center text-sm leading-relaxed text-mk-body'>
                Enter your account email and we&apos;ll send a link to set a
                new one.
            </p>

            {sent ? (
                <div className='mt-8 rounded-lg border border-mk-line bg-mk-canvas p-6 text-center'>
                    <p className='text-sm font-medium text-mk-ink'>
                        Check your inbox
                    </p>
                    <p className='mt-2 text-sm leading-relaxed text-mk-body'>
                        If an account exists for {email || 'that address'},
                        a password reset link is on its way.
                    </p>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    className='mt-8 flex flex-col gap-3'>
                    <div>
                        <label htmlFor='forgot-email' className='sr-only'>
                            Email address
                        </label>
                        <input
                            id='forgot-email'
                            name='email'
                            type='email'
                            required
                            autoComplete='username'
                            inputMode='email'
                            placeholder='Email address'
                            aria-label='Email address'
                            value={email}
                            onChange={event => setEmail(event.target.value)}
                            className='mk-input'
                        />
                    </div>

                    {error && (
                        <p
                            role='alert'
                            className='rounded-lg border border-mk-line bg-mk-canvas px-4 py-3 text-sm text-mk-ink'>
                            {error}
                        </p>
                    )}

                    <button
                        type='submit'
                        disabled={loading}
                        className='mt-2 inline-flex h-11 w-full items-center justify-center rounded-lg bg-mk-accent text-sm font-medium text-white transition-colors hover:bg-mk-accent-hover disabled:cursor-not-allowed disabled:opacity-60'>
                        {loading ? 'Sending...' : 'Send reset link'}
                    </button>
                </form>
            )}

            <p className='mt-8 text-center text-sm text-mk-body'>
                Remembered it?{' '}
                <Link
                    href='/login'
                    className='font-medium text-mk-accent transition-colors hover:text-mk-accent-hover'>
                    Back to login
                </Link>
            </p>
        </div>
    );
}
