'use client';

import AuthForm from './auth-form';

/**
 * Customer account login card (`/account`) - the traveler door. Rendered
 * inside the account shell (app/(login)/account/layout.tsx), which owns the
 * brand panel, so this component is only the right-hand card. Email +
 * password against the same Better Auth backend as every door; the account
 * itself is created automatically by a booking (welcome email carries the
 * set-password link that lands on /account/reset).
 */
export function AccountLogin() {
    return (
        <div className='w-full rounded-[16px] border border-it-border bg-it-white px-8 pb-6 pt-8 shadow-it-md'>
            <h1 className='m-0 font-it-display text-xl font-semibold text-it-heading'>
                Log in
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-it-text-muted'>
                Use the email from your booking. First time here? Your welcome
                email has a set-password link.
            </p>

            <AuthForm variant='account' />

            <p className='mt-4 text-xs leading-[1.5] text-it-text-muted'>
                Just need one booking? The links in your confirmation email
                work without a password.
            </p>
        </div>
    );
}
