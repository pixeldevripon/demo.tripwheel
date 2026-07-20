'use client';

import { ForgotCard } from './forgot-card';

/**
 * Customer forgot-password request card (`/account/forgot`). Rendered inside
 * the account shell - its own screen, never shared with the operator portal
 * or staff door.
 */
export function AccountForgot() {
    return (
        <ForgotCard
            backHref='/account'
            resetPath='/account/reset'
            description="Enter the email from your booking and we'll send a link to set a new one."
            sentNote='If that email has an account, a reset link is on its way.'
            emailPlaceholder='you@example.com'
            idPrefix='af'
        />
    );
}
