'use client';

import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function ResetPasswordForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    if (!token) {
        return (
            <div className='mx-auto w-full max-w-sm space-y-3'>
                <p className='text-sm font-semibold text-slate-900'>
                    Invalid reset link
                </p>
                <p className='text-sm text-slate-500'>
                    This password reset link is invalid or has expired.{' '}
                    <Link
                        href='/forgot-password'
                        className='font-semibold text-it-primary transition-colors hover:text-it-primary-hover'>
                        Request a new one.
                    </Link>
                </p>
            </div>
        );
    }

    const handleSubmit = async (e: React.SubmitEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        if (password.length < 12) {
            setError('Password must be at least 12 characters.');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match.');
            return;
        }

        setLoading(true);

        const { error: authError } = await authClient.resetPassword({
            newPassword: password,
            token,
        });

        setLoading(false);

        if (authError) {
            setError(
                authError.message ||
                    'Failed to reset password. The link may have expired.'
            );
        } else {
            // All existing sessions are revoked - redirect to login
            router.push('/login?reset=success');
        }
    };

    return (
        <form onSubmit={handleSubmit} className='mx-auto w-full max-w-sm'>
            <p className='mb-6 text-sm text-slate-500'>
                Your new password must be at least 12 characters.
            </p>

            <div className='space-y-5'>
                <div className='relative'>
                    <label
                        htmlFor='password'
                        className='absolute -top-2 left-4 z-10 bg-white px-1.5 text-[11px] font-medium text-slate-500'>
                        New password
                    </label>
                    <input
                        id='password'
                        type='password'
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder='••••••••••••'
                        required
                        minLength={12}
                        aria-invalid={!!error}
                        className='h-13 w-full rounded-2xl border border-slate-200 bg-white px-5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-it-primary focus:ring-2 focus:ring-it-primary-subtle autofill:shadow-[inset_0_0_0_1000px_#ffffff] autofill:[-webkit-text-fill-color:#0f172a]'
                    />
                </div>

                <div className='relative'>
                    <label
                        htmlFor='confirm-password'
                        className='absolute -top-2 left-4 z-10 bg-white px-1.5 text-[11px] font-medium text-slate-500'>
                        Confirm new password
                    </label>
                    <input
                        id='confirm-password'
                        type='password'
                        value={confirmPassword}
                        onChange={e => setConfirmPassword(e.target.value)}
                        placeholder='••••••••••••'
                        required
                        minLength={12}
                        aria-invalid={!!error}
                        className='h-13 w-full rounded-2xl border border-slate-200 bg-white px-5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-it-primary focus:ring-2 focus:ring-it-primary-subtle autofill:shadow-[inset_0_0_0_1000px_#ffffff] autofill:[-webkit-text-fill-color:#0f172a]'
                    />
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
                    {loading ? 'Saving...' : 'Reset password'}
                </button>
            </div>

            <p className='mt-8 text-center text-sm text-slate-500'>
                <Link
                    href='/login'
                    className='font-semibold text-it-primary transition-colors hover:text-it-primary-hover'>
                    Back to sign in
                </Link>
            </p>
        </form>
    );
}
