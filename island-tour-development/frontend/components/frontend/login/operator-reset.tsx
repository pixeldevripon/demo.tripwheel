'use client';

import Link from 'next/link';
import { useState } from 'react';
import { CircleAlert } from 'lucide-react';
import { Field, inputClass, primaryBtn, SuccessBlock } from './login-ui';

/**
 * Operator reset-password landing card (`/portal/reset`), reached from the reset
 * email link (spec 3.5). Rendered inside the portal shell. Set a new password
 * (min 12 chars, no confirm field per the form-mechanics bundle). Completing a
 * reset does NOT bypass 2FA and invalidates other sessions - enforced
 * server-side when wired. Two states: the form and the expired-link state
 * (`expired` prop from a `?state=expired` search param). SCREENS ONLY.
 */
export function OperatorReset({ expired = false }: { expired?: boolean }) {
    const [showPw, setShowPw] = useState(false);
    const [done, setDone] = useState(false);

    const cardClass =
        'w-full rounded-[16px] border border-it-border bg-it-white px-7 pb-6.5 pt-7.5 shadow-it-md';

    if (expired) {
        return (
            <div className={`${cardClass} text-center`}>
                <div className='mx-auto mb-3.5 flex size-13 items-center justify-center rounded-full bg-red-50'>
                    <CircleAlert className='size-6 text-red-700' strokeWidth={1.75} />
                </div>
                <h1 className='m-0 font-it-display text-[22px] font-semibold text-it-heading'>
                    This link has expired
                </h1>
                <p className='mx-auto mt-2 max-w-80 text-[14px] text-it-text-muted'>
                    Reset links are valid for 60 minutes. Request a new one from the login page.
                </p>
                <Link href='/portal' className={`${primaryBtn} mt-5 no-underline`}>
                    Back to login
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
                />
            </div>
        );
    }

    return (
        <div className={cardClass}>
            <h1 className='m-0 font-it-display text-[23px] font-semibold text-it-heading'>
                Set a new password
            </h1>
            <p className='mb-5.5 mt-1.5 text-[14px] text-it-text-muted'>
                Choose a password you don&apos;t use anywhere else.
            </p>
            <form onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
                <Field label='New password' htmlFor='o-new-pw'>
                    <div className='relative'>
                        <input
                            id='o-new-pw'
                            type={showPw ? 'text' : 'password'}
                            name='password'
                            autoComplete='new-password'
                            minLength={12}
                            className={`${inputClass} pr-16`}
                        />
                        <button
                            type='button'
                            aria-live='polite'
                            onClick={() => setShowPw((v) => !v)}
                            className='absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold text-it-text-muted transition-colors hover:bg-it-surface hover:text-it-ink'>
                            {showPw ? 'Hide' : 'Show'}
                        </button>
                    </div>
                    <p className='mt-1.5 text-[12.5px] text-it-text-muted'>
                        At least 12 characters.
                    </p>
                </Field>
                <button type='submit' className={primaryBtn}>
                    Update password
                </button>
            </form>
        </div>
    );
}
