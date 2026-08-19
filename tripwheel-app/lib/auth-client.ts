import { createAuthClient } from 'better-auth/react';

import { API_URL } from '@/lib/links';

/**
 * Client for the shared better-auth backend (api.tripwheel.app) - the same
 * instance the dashboard authenticates against, so a login here IS a
 * dashboard login. The backend's cross-subdomain cookie config makes the
 * session visible to dashboard.tripwheel.app after we redirect.
 */
export const authClient = createAuthClient({
    baseURL: API_URL,
});

export const { signIn, signOut, useSession } = authClient;

/**
 * The authoritative role of the current session, or null when signed out.
 *
 * `role` is a backend additionalField (Prisma enum - UPPERCASE values like
 * 'ADMIN', matching the dashboard's own checks), which this client's plain
 * `createAuthClient` cannot infer - so the cast lives HERE, once, instead of
 * being re-derived at every door that needs it.
 */
export async function getSessionRole(): Promise<string | null> {
    const session = await authClient.getSession();
    return (
        (session.data?.user as { role?: string } | undefined)?.role ?? null
    );
}
