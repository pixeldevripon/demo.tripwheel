'use client';

import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { Field, inputClass, primaryBtn, ErrorNote } from './login-ui';

/**
 * Operator forgot-password request card (`/portal/forgot`). Rendered inside the
 * portal shell (brand panel persists; only this card swaps in). Enumeration-proof
 * — the result is always positive. Sends a reset link that lands on `/portal/reset`.
 */
export function OperatorForgot() {
    const [email, setEmail] = useState('');
    const [sent, setSent] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        setError('');
        const { error: authError } = await authClient.requestPasswordReset({
            email,
            redirectTo: `${window.location.origin}/portal/reset`,
        });
        setLoading(false);
        if (authError) {
            // Surface genuine errors (rate-limit, server fault) but not
            // enumeration-sensitive ones — just show the success note anyway.
            const msg = authError.message?.toLowerCase() ?? '';
            if (msg.includes('rate') || msg.includes('too many')) {
                setError('Too many requests. Please wait a moment and try again.');
                return;
            }
        }
        // Always show success (enumeration-proof)
        setSent(true);
    }

    return (
        <div className='w-full rounded-[16px] border border-it-border bg-it-white px-7 pb-6.5 pt-7.5 shadow-it-md'>
            <Link
                href='/portal'
                className='mb-3.5 inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-it-text-muted transition-colors hover:text-it-ink'>
                <ArrowLeft className='size-3.5' strokeWidth={1.5} />
                Back to login
            </Link>

            <h1 className='m-0 font-it-display text-[23px] font-semibold text-it-heading'>
                Forgot your password?
            </h1>
            <p className='mb-5.5 mt-1.5 text-[14px] text-it-text-muted'>
                Enter your operator email and we&apos;ll send a link to set a new one.
            </p>

            {!sent ? (
                <form onSubmit={handleSubmit}>
                    <Field label='Email' htmlFor='of-email'>
                        <input
                            id='of-email'
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

                    {error && <ErrorNote>{error}</ErrorNote>}

                    <button
                        type='submit'
                        disabled={loading}
                        className={`${primaryBtn} disabled:cursor-not-allowed disabled:opacity-60`}>
                        {loading ? 'Sending…' : 'Email me a reset link'}
                    </button>
                </form>
            ) : (
                <div className='flex gap-2 rounded-[10px] bg-it-surface px-3.5 py-2.5 text-[13px] text-it-text-muted'>
                    <Mail className='mt-0.5 size-4 shrink-0' strokeWidth={1.5} />
                    If that email has an operator account, a reset link is on its way.
                </div>
            )}
        </div>
    );
}
