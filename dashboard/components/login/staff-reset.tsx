'use client';

import { ResetCard } from './reset-card';
import { staffBtn } from './login-ui';

/**
 * Staff reset-password landing card (`/staff/reset`), reached from staff
 * invite and reset email links. Rendered inside the dark staff shell - its
 * own screen, never shared with the operator portal.
 */
export function StaffReset({ expired = false }: { expired?: boolean }) {
    return (
        <ResetCard
            loginHref='/staff'
            forgotHref='/staff/forgot'
            resetHref='/staff/reset'
            loginLabel='Sign in'
            expired={expired}
            buttonClass={staffBtn}
            idPrefix='s'
        />
    );
}
