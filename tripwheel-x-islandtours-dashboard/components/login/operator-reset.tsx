'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { AlertCircleIcon } from '@hugeicons/core-free-icons';

import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { Field, inputClass, primaryBtn, SuccessBlock, ErrorNote } from './login-ui';

/**
 * Operator reset-password landing card (`/portal/reset`), reached from the reset
 * email link. Rendered inside the portal shell. Reads the `?token=...` query
 * param client-side and calls `authClient.resetPassword()`. On success redirects
 * to `/portal?reset=success` (all other sessions are revoked server-side).
 * Two states: the form and the expired-link state (`expired` prop from a
 * `?state=expired` search param, set by the server component wrapper).
 */
export function OperatorReset({ expired = false }: { expired?: boolean }) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const [showPw, setShowPw] = useState(false);
    const [password, setPassword] = useState('');
    const [done, setDone] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const cardClass =
        'w-full rounded-[16px] border border-it-border bg-it-white px-8 pb-6 pt-8 shadow-it-md';

    /** No token in URL — link is broken/missing */
    if (!expired && !token) {
        return (
            <div className={`${cardClass} text-center`}>
                <div className='mx-auto mb-3 flex size-13 items-center justify-center rounded-full bg-danger-subtle'>
                    <HugeiconsIcon icon={AlertCircleIcon} className='size-6 text-danger-fg' strokeWidth={1.75} />
                </div>
                <h1 className='m-0 font-it-display text-xl font-semibold text-it-heading'>
                    Invalid reset link
                </h1>
                <p className='mx-auto mt-2 max-w-80 text-sm text-it-text-muted'>
                    This link is invalid or has already been used.
                </p>
                <Link href='/portal/forgot' className={`${primaryBtn} mt-4 no-underline`}>
                    Request a new link
                </Link>
            </div>
        );
 }

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (password.length < 12) {
            setError('Password must be at least 12 characters.');
            return;
        }
        setLoading(true);
        setError('');
        const { error: authError } = await authClient.resetPassword({
            newPassword: password,
            token: token!,
        });
        setLoading(false);
        if (authError) {
            // Token expired mid-session → redirect to expired state
            const msg = authError.message?.toLowerCase() ?? '';
            if (msg.includes('expired') || msg.includes('invalid') || msg.includes('not found')) {
                router.replace('/portal/reset?state=expired');
                return;
            }
            setError(authError.message || 'Failed to reset password.');
        } else {
            // All other sessions are revoked server-side
            setDone(true);
        }
    }

    if (expired) {
        return (
            <div className={`${cardClass} text-center`}>
                <div className='mx-auto mb-3 flex size-13 items-center justify-center rounded-full bg-danger-subtle'>
                    <HugeiconsIcon icon={AlertCircleIcon} className='size-6 text-danger-fg' strokeWidth={1.75} />
                </div>
                <h1 className='m-0 font-it-display text-xl font-semibold text-it-heading'>
                    This link has expired
                </h1>
                <p className='mx-auto mt-2 max-w-80 text-sm text-it-text-muted'>
                    Reset links are valid for 60 minutes. Request a new one from the login page.
                </p>
                <Link href='/portal/forgot' className={`${primaryBtn} mt-4 no-underline`}>
                    Request a new link
                </Link>
            </div>
        );
    }

    if (done) {
        return (
            <div className={cardClass}>
                <SuccessBlock
                    title='Password updated.'
                    body='For your security, we signed out your other sessions. Log in with your new password.'
                    loginHref='/portal'
                    loginLabel='Log in to portal'
                />
            </div>
        );
    }

    return (
        <div className={cardClass}>
            <h1 className='m-0 font-it-display text-xl font-semibold text-it-heading'>
                Set a new password
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-it-text-muted'>
                Choose a password you don&apos;t use anywhere else.
            </p>
            <form onSubmit={handleSubmit}>
                <Field label='New password' htmlFor='o-new-pw'>
                    <div className='relative'>
                        <input
                            id='o-new-pw'
                            aria-label='New password'
                            type={showPw ? 'text' : 'password'}
                            name='password'
                            autoComplete='new-password'
                            minLength={12}
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            className={`${inputClass} pr-16`}
                        />
                        <button
                            type='button'
                            aria-live='polite'
                            onClick={() => setShowPw((v) => !v)}
                            className='absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-it-text-muted transition-colors hover:bg-it-surface hover:text-it-ink'>
                            {showPw ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <p className='mt-1.5 text-xs text-it-text-muted'>
                        At least 12 characters.
                    </p>
                </Field>

                {error && <ErrorNote>{error}</ErrorNote>}

                <button
                    type='submit'
                    disabled={loading}
                    className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                    {loading ? 'Saving…' : 'Update password'}
                </button>
            </form>
        </div>
    );
}
