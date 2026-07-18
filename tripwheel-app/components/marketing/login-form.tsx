'use client';

import { ViewIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';

import { signIn } from '@/lib/auth-client';
import { DASHBOARD_URL } from '@/lib/links';

/**
 * Right column of the login screen (Webflow ref): logo, heading, email +
 * password with visibility toggle, accent Continue, sign-up line.
 *
 * Credentials only for now - social/SSO options land later. This IS the
 * dashboard login: it authenticates against the shared better-auth backend
 * (see lib/auth-client.ts) and a successful sign-in hard-navigates to the
 * dashboard, which picks the session up from the shared cookie.
 */
export function LoginForm() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { data, error: authError } = await signIn.email({
                email,
                password,
            });
            if (authError) {
                setError(
                    authError.message ||
                        authError.statusText ||
                        'Invalid email or password.'
                );
                setLoading(false);
            } else if (!data) {
                // No response at all (network/CORS failure) - better-fetch can
                // resolve with neither data nor error in this case.
                setError(
                    'Could not reach the authentication server. Please try again.'
                );
                setLoading(false);
            } else {
                // Full navigation (not router.push) - the dashboard is a
                // separate deployment on another subdomain.
                window.location.assign(DASHBOARD_URL);
            }
        } catch (err: unknown) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'An unexpected error occurred. Please try again.'
            );
            setLoading(false);
        }
    }

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
                Log in to your account
            </h1>

            <form onSubmit={handleSubmit} className='mt-8 flex flex-col gap-3'>
                <div>
                    <label htmlFor='login-email' className='sr-only'>
                        Email address
                    </label>
                    <input
                        id='login-email'
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

                <div className='relative'>
                    <label htmlFor='login-password' className='sr-only'>
                        Password
                    </label>
                    <input
                        id='login-password'
                        name='password'
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete='current-password'
                        placeholder='Password'
                        aria-label='Password'
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
                            icon={showPassword ? ViewIcon : ViewOffSlashIcon}
                            className='size-4'
                        />
                    </button>
                </div>

                <div>
                    <Link
                        href='/forgot'
                        className='text-xs font-medium text-mk-accent transition-colors hover:text-mk-accent-hover'>
                        Forgot your password?
                    </Link>
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
                    {loading ? 'Signing in...' : 'Continue'}
                </button>
            </form>
        </div>
    );
}

