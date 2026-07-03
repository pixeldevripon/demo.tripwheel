'use client';

import { authClient } from '@/lib/auth-client';
import { CheckIcon } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

export function ForgotPasswordForm() {
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    const emailLooksValid = /^\S+@\S+\.\S+$/.test(email);

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const { error: authError } = await authClient.requestPasswordReset({
            email,
            redirectTo: `${window.location.origin}/reset-password`,
        });

        setLoading(false);

        if (authError) {
            setError(
                authError.message || 'Something went wrong. Please try again.'
            );
        } else {
            setSubmitted(true);
        }
    };

    if (submitted) {
        return (
            <div className='mx-auto w-full max-w-sm space-y-4 text-center'>
                <span className='mx-auto flex size-12 items-center justify-center rounded-full bg-it-green-subtle text-it-green'>
                    <CheckIcon className='size-6' strokeWidth={3} />
                </span>
                <p className='text-sm text-slate-600'>
                    If an account exists for <strong>{email}</strong>,
                    we&apos;ve sent a password reset link. Check your inbox
                    (and spam folder).
                </p>
                <Link
                    href='/login'
                    className='inline-block text-sm font-semibold text-it-primary transition-colors hover:text-it-primary-hover'>
                    Back to sign in
                </Link>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className='mx-auto w-full max-w-sm'>
            <p className='mb-6 text-sm text-slate-500'>
                Enter your email address and we&apos;ll send you a link to
                reset your password.
            </p>

            <div className='space-y-5'>
                <div className='relative'>
                    <input
                        id='email'
                        type='email'
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder='name@example.com'
                        required
                        aria-invalid={!!error}
                        aria-label='Email'
                        className='h-13 w-full rounded-2xl border border-slate-200 bg-white px-5 pr-12 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-it-primary focus:ring-2 focus:ring-it-primary-subtle autofill:shadow-[inset_0_0_0_1000px_#ffffff] autofill:[-webkit-text-fill-color:#0f172a]'
                    />
                    {emailLooksValid && (
                        <span className='absolute top-1/2 right-4 flex size-5 -translate-y-1/2 items-center justify-center rounded-full border border-emerald-400 text-emerald-500'>
                            <CheckIcon className='size-3' strokeWidth={3} />
                        </span>
                    )}
                </div>

                {error && (
                    <p role='alert' className='text-sm text-red-500'>
                        {error}
                    </p>
                )}

                <button
                    type='submit'
                    disabled={loading}
                    className='h-13 w-full cursor-pointer rounded-full bg-it-primary text-sm font-bold tracking-wide text-it-primary-fg shadow-lg shadow-it-primary/25 transition-colors hover:bg-it-primary-hover disabled:cursor-not-allowed disabled:opacity-60'>
                    {loading ? 'Sending...' : 'Send reset link'}
                </button>
            </div>

            <p className='mt-8 text-center text-sm text-slate-500'>
                Remember your password?{' '}
                <Link
                    href='/login'
                    className='font-semibold text-it-primary transition-colors hover:text-it-primary-hover'>
                    Sign in
                </Link>
            </p>
        </form>
    );
}
