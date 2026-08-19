'use client';

import { ForgotCard } from './forgot-card';
import { staffBtn } from './login-ui';

/**
 * Staff forgot-password request card (`/staff/forgot`). Rendered inside the
 * dark staff shell - its own screen, never shared with the operator portal.
 */
export function StaffForgot() {
    return (
        <ForgotCard
            backHref='/staff'
            resetPath='/staff/reset'
            description="Enter your staff email and we'll send a link to set a new one."
            sentNote='If that email has staff access, a reset link is on its way.'
            emailPlaceholder='you@islandtours.com'
            buttonClass={staffBtn}
            idPrefix='sf'
        />
    );
}
