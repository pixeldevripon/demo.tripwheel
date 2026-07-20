'use client';

import { ResetCard } from './reset-card';

/**
 * Customer set/reset-password landing card (`/account/reset`), reached from
 * the booking welcome email's set-password link and from forgot-password
 * emails. Rendered inside the account shell - its own screen, never shared
 * with the operator portal or staff door.
 */
export function AccountReset({ expired = false }: { expired?: boolean }) {
    return (
        <ResetCard
            loginHref='/account'
            forgotHref='/account/forgot'
            resetHref='/account/reset'
            loginLabel='Log in'
            expired={expired}
            idPrefix='a'
        />
    );
}
