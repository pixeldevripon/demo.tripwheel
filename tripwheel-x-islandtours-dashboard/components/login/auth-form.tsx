import { signIn } from '@/lib/auth-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';
import {
    ErrorNote,
    Field,
    inputClass,
    primaryBtn,
    quietLink,
    staffBtn,
} from './login-ui';

interface AuthFormProps {
    /**
     * Which door renders the form. Same sign-in logic on every door; the
     * variant only pins the surface's own forgot route, button style and
     * placeholder so the doors never link into (or look like) each other.
     * `account` is the customer/traveler door.
     */
    variant?: 'portal' | 'staff' | 'account';
}

const FORGOT_HREF: Record<'portal' | 'staff' | 'account', string> = {
    portal: '/portal/forgot',
    staff: '/staff/forgot',
    account: '/account/forgot',
};

const ID_PREFIX: Record<'portal' | 'staff' | 'account', string> = {
    portal: 'o',
    staff: 's',
    account: 'a',
};

const SUBMIT_CLASS: Record<'portal' | 'staff' | 'account', string> = {
    portal: primaryBtn,
    staff: staffBtn,
    account: primaryBtn,
};

export default function AuthForm({ variant = 'portal' }: AuthFormProps) {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const isStaff = variant === 'staff';
    const idPrefix = ID_PREFIX[variant];
    const forgotHref = FORGOT_HREF[variant];
    const submitClass = SUBMIT_CLASS[variant];

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { error: authError } = await signIn.email({
                email,
                password,
            });
            if (authError) {
                setError(authError.message || 'Invalid email or password.');
            } else {
                // When 2FA is enabled: setStep(2) instead of redirect
                router.push('/');
                router.refresh();
            }
        } catch (err: unknown) {
            const msg =
                err instanceof Error
                    ? err.message
                    : 'An unexpected error occurred.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    }
    return (
        <form onSubmit={handleSubmit}>
            <Field label='Email' htmlFor={`${idPrefix}-email`}>
                <input
                    id={`${idPrefix}-email`}
                    aria-label='Email'
                    type='email'
                    name='email'
                    autoComplete='username'
                    inputMode='email'
                    placeholder={
                        isStaff
                            ? 'you@islandtours.com'
                            : variant === 'account'
                              ? 'you@example.com'
                              : 'you@yourcompany.com'
                    }
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    className={inputClass}
                />
            </Field>

            <Field label='Password' htmlFor={`${idPrefix}-pw`}>
                <div className='relative'>
                    <input
                        id={`${idPrefix}-pw`}
                        aria-label='Password'
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
                        className='absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-it-text-muted transition-colors hover:bg-it-surface hover:text-it-ink'>
                        {showPw ? 'Hide' : 'Show'}
                    </button>
                </div>
            </Field>

            <div className='mb-4 mt-0.5 flex items-center justify-end'>
                <Link href={forgotHref} className={quietLink}>
                    Forgot your password?
                </Link>
            </div>

            {error && <ErrorNote>{error}</ErrorNote>}

            <button
                type='submit'
                disabled={loading}
                className={`${submitClass} disabled:cursor-not-allowed disabled:opacity-60`}>
                {loading ? 'Signing in…' : isStaff ? 'Sign in' : 'Log in'}
            </button>
        </form>
    );
}
