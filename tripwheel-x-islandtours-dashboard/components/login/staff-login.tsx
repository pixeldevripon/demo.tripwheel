'use client';

import AuthForm from './auth-form';

/**
 * Staff sign-in card (`/staff`). Rendered inside the dark staff shell
 * (app/(login)/staff/layout.tsx). Email + password against the same Better
 * Auth backend as every door - authorization is always server-side (role +
 * effective permissions per request); the separate URL and styling are surface
 * separation, not a security control. Google Workspace SSO replaces this form
 * in login-plan Phase 5.
 */
export function StaffLogin() {
    return (
        <div className='w-full rounded-[16px] bg-it-white px-8 pb-6 pt-8 shadow-2xl shadow-black/40'>
            <h1 className='m-0 font-it-display text-xl font-semibold text-it-heading'>
                Sign in
            </h1>
            <p className='mb-6 mt-1.5 text-sm text-it-text-muted'>
                Use the staff account from your invite email.
            </p>

            <AuthForm variant='staff' />

            <p className='mt-4 text-xs leading-[1.5] text-it-text-muted'>
                We&apos;ll never ask for your password by email, text, or phone.
            </p>
        </div>
    );
}
