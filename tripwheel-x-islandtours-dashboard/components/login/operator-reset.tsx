'use client';

import { ResetCard } from './reset-card';

/**
 * Operator reset-password landing card (`/portal/reset`), reached from the
 * reset and invite email links. Rendered inside the portal shell. The shared
 * ResetCard owns the token/expiry/success state machine; this wrapper pins the
 * operator door's routes.
 */
export function OperatorReset({ expired = false }: { expired?: boolean }) {
    return (
        <ResetCard
            loginHref='/portal'
            forgotHref='/portal/forgot'
            resetHref='/portal/reset'
            loginLabel='Log in to portal'
            expired={expired}
            idPrefix='o'
        />
    );
}
