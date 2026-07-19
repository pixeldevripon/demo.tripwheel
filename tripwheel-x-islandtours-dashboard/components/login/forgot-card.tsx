'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowLeft02Icon, Mail01Icon } from '@hugeicons/core-free-icons';

import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useState } from 'react';
import { ErrorNote, Field, inputClass, primaryBtn } from './login-ui';

export interface ForgotCardProps {
    /** Login page this card belongs to (the "Back to login" target). */
    backHref: string;
    /** Path the reset EMAIL should land on (appended to window.origin). */
    resetPath: string;
    description: string;
    /** Enumeration-proof success note - always positive, never confirms the account. */
    sentNote: string;
    emailPlaceholder?: string;
    buttonClass?: string;
    /** Distinct input id per surface (one card per page, but keep ids unique). */
    idPrefix?: string;
}

/**
 * Forgot-password request card, shared by the operator (`/portal/forgot`) and
 * staff (`/staff/forgot`) doors. ONE implementation of the enumeration-proof
 * request logic; each door passes its own copy, targets and button style so
 * the surfaces stay visually separate.
 */
export function ForgotCard({
    backHref,
    resetPath,
    description,
    sentNote,
    emailPlaceholder = 'you@yourcompany.com',
    buttonClass = primaryBtn,
    idPrefix = 'f',
}: ForgotCardProps) {
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
            redirectTo: `${window.location.origin}${resetPath}`,
        });
        setLoading(false);
        if (authError) {
            // Surface genuine errors (rate-limit, server fault) but not
            // enumeration-sensitive ones - just show the success note anyway.
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
        <div className='w-full rounded-[16px] border border-it-border bg-it-white px-8 pb-6 pt-8 shadow-it-md'>
            <Link
                href={backHref}
                className='mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-it-text-muted transition-colors hover:text-it-ink'>
                <HugeiconsIcon icon={ArrowLeft02Icon} className='size-3.5' strokeWidth={1.5} />
                Back to login
            </Link>

            <h1 className='m-0 font-it-display text-xl font-semibold text-it-heading'>
                Forgot your password?
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-it-text-muted'>{description}</p>

            {!sent ? (
                <form onSubmit={handleSubmit}>
                    <Field label='Email' htmlFor={`${idPrefix}-email`}>
                        <input
                            id={`${idPrefix}-email`}
                            aria-label='Email'
                            type='email'
                            name='email'
                            autoComplete='username'
                            inputMode='email'
                            placeholder={emailPlaceholder}
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
                        className={`${buttonClass} disabled:cursor-not-allowed disabled:opacity-60`}>
                        {loading ? 'Sending…' : 'Email me a reset link'}
                    </button>
                </form>
            ) : (
                <div className='flex gap-2 rounded-[10px] bg-it-surface px-3 py-2.5 text-sm text-it-text-muted'>
                    <HugeiconsIcon icon={Mail01Icon} className='mt-0.5 size-4 shrink-0' strokeWidth={1.5} />
                    {sentNote}
                </div>
            )}
        </div>
    );
}
