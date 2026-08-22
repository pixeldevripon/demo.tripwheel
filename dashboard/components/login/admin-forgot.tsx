'use client';

import { ForgotCard } from './forgot-card';
import { adminBtn } from './login-ui';

/**
 * Admin forgot-password request card (`/admin/forgot`). Rendered inside the
 * admin shell - its own screen, never shared with the staff or operator doors.
 *
 * The shared `ForgotCard` is enumeration-proof by design (it shows the same
 * positive note whether or not the account exists), which is exactly the
 * property this door needs, so there is nothing admin-specific to add here.
 */
export function AdminForgot() {
    return (
        <ForgotCard
            backHref='/admin'
            resetPath='/admin/reset'
            description="Enter your admin email and we'll send a link to set a new one."
            sentNote='If that email has admin access, a reset link is on its way.'
            emailPlaceholder='you@islandtours.com'
            buttonClass={adminBtn}
            idPrefix='af'
        />
    );
}
