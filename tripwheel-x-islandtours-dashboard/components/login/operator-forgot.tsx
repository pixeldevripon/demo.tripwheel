'use client';

import { ForgotCard } from './forgot-card';

/**
 * Operator forgot-password request card (`/portal/forgot`). Rendered inside the
 * portal shell (brand panel persists; only this card swaps in). The shared
 * ForgotCard owns the enumeration-proof request logic; this wrapper pins the
 * operator door's routes and copy.
 */
export function OperatorForgot() {
    return (
        <ForgotCard
            backHref='/portal'
            resetPath='/portal/reset'
            description="Enter your operator email and we'll send a link to set a new one."
            sentNote='If that email has an operator account, a reset link is on its way.'
            emailPlaceholder='you@yourcompany.com'
            idPrefix='of'
        />
    );
}
