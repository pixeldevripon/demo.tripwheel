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
