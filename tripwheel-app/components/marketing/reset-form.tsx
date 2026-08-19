'use client';

import { ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { authClient } from '@/lib/auth-client';

/**
 * Set-new-password screen, reached from the reset email link
 * (`/reset?token=...`). better-auth appends `?error=...` instead when the
 * token is invalid or expired - that renders the try-again note. On success
 * the user is sent to /login to sign in with the new password.
 */
export function ResetForm() {
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const linkError = searchParams.get('error');

    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [done, setDone] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');
        const { error: authError } = await authClient.resetPassword({
            newPassword: password,
            token: token ?? '',
        });
        setLoading(false);
        if (authError) {
            setError(
                authError.message ||
                    'Could not reset your password. The link may have expired.'
            );
        } else {
            setDone(true);
        }
    }

    const invalidLink = !!linkError || !token;

    return (
        <div className='mx-auto w-full max-w-sm'>
            <Link href='/' className='flex justify-center'>
                <Image
                    src='/logo/logo-light.svg'
                    alt='TripWheel'
                    width={125}
                    height={16}
                    priority
                />
            </Link>

            <h1 className='mt-8 text-center text-mk-plan font-medium text-mk-ink'>
                Set a new password
            </h1>

            {invalidLink ? (
                <div className='mt-8 rounded-lg border border-mk-line bg-mk-canvas p-6 text-center'>
                    <p className='text-sm font-medium text-mk-ink'>
                        This reset link is invalid or has expired
                    </p>
                    <p className='mt-2 text-sm leading-relaxed text-mk-body'>
                        Request a fresh one and try again.
                    </p>
                    <Link
                        href='/forgot'
                        className='mt-4 inline-flex h-10 items-center rounded-lg bg-mk-accent px-6 text-sm font-medium text-white transition-colors hover:bg-mk-accent-hover'>
                        Request a new link
                    </Link>
                </div>
            ) : done ? (
                <div className='mt-8 rounded-lg border border-mk-line bg-mk-canvas p-6 text-center'>
                    <p className='text-sm font-medium text-mk-ink'>
                        Password updated
                    </p>
                    <p className='mt-2 text-sm leading-relaxed text-mk-body'>
                        Your new password is set - log in to continue.
                    </p>
                    <Link
                        href='/login'
                        className='mt-4 inline-flex h-10 items-center rounded-lg bg-mk-accent px-6 text-sm font-medium text-white transition-colors hover:bg-mk-accent-hover'>
                        Continue to login
                    </Link>
                </div>
            ) : (
                <form
                    onSubmit={handleSubmit}
                    className='mt-8 flex flex-col gap-3'>
                    <div className='relative'>
                        <label htmlFor='reset-password' className='sr-only'>
                            New password
                        </label>
                        <input
                            id='reset-password'
                            name='password'
                            type={showPassword ? 'text' : 'password'}
                            required
                            minLength={8}
                            autoComplete='new-password'
                            placeholder='New password (min. 8 characters)'
                            aria-label='New password'
                            value={password}
                            onChange={event => setPassword(event.target.value)}
                            className='mk-input pr-12'
                        />
                        <button
                            type='button'
                            aria-label={
                                showPassword ? 'Hide password' : 'Show password'
                            }
                            onClick={() => setShowPassword(value => !value)}
                            className='absolute inset-y-0 right-0 flex w-12 items-center justify-center text-mk-faint transition-colors hover:text-mk-accent'>
                            <HugeiconsIcon
                                icon={
                                    showPassword ? ViewIcon : ViewOffSlashIcon
                                }
                                className='size-4'
                            />
                        </button>
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
                        {loading ? 'Saving...' : 'Set new password'}
                    </button>
                </form>
            )}
        </div>
    );
}
