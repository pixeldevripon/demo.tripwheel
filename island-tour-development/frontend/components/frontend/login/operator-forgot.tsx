'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Mail } from 'lucide-react';
import { Field, inputClass, primaryBtn } from './login-ui';

/**
 * Operator forgot-password request card (`/portal/forgot`). Rendered inside the
 * portal shell (brand panel persists; only this card swaps in). Enumeration-proof
 * - the result is always positive (spec 1.1, 3.4). Sends a reset link that lands
 * on `/portal/reset`. SCREENS ONLY - no backend call.
 */
export function OperatorForgot() {
    const [sent, setSent] = useState(false);

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

            <form onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
                <Field label='Email' htmlFor='of-email'>
                    <input
                        id='of-email'
                        type='email'
                        name='email'
                        autoComplete='username'
                        inputMode='email'
                        placeholder='you@yourcompany.com'
                        className={inputClass}
                    />
                </Field>
                <button type='submit' className={primaryBtn}>
                    Email me a reset link
                </button>
            </form>

            {sent && (
                <div className='mt-4 flex gap-2 rounded-[10px] bg-it-surface px-3.5 py-2.5 text-[13px] text-it-text-muted'>
                    <Mail className='mt-0.5 size-4 shrink-0' strokeWidth={1.5} />
                    If that email has an operator account, a reset link is on its way.
                </div>
            )}
        </div>
    );
}
