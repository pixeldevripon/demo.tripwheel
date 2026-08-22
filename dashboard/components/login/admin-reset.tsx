'use client';

import { adminBtn } from './login-ui';
import { ResetCard } from './reset-card';

/**
 * Admin reset-password landing card (`/admin/reset`), reached from admin invite
 * and reset email links. Rendered inside the admin shell - its own screen,
 * never shared with the staff or operator doors.
 */
export function AdminReset({ expired = false }: { expired?: boolean }) {
    return (
        <ResetCard
            loginHref='/admin'
            forgotHref='/admin/forgot'
            resetHref='/admin/reset'
            loginLabel='Sign in'
            expired={expired}
            buttonClass={adminBtn}
            idPrefix='a'
        />
    );
}
