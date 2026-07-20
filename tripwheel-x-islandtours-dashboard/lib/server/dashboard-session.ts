import 'server-only';

import { authClient } from '@/lib/auth-client';
import { serverAuthHeaders } from '@/lib/server/auth-headers';
import { cache } from 'react';

const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050';

async function safeJson(res: Response) {
    try {
        const text = await res.text();
        return text ? JSON.parse(text) : null;
    } catch {
        return null;
    }
}

/**
 * The session's role and nothing else - one call to Better Auth.
 *
 * For server components that only gate or redirect on `role`. Never cached
 * across requests: a transient failure returns null, and remembering that
 * would bounce a logged-in user until the entry expired. React `cache()` still
 * dedupes within one render pass, which is safe.
 */
export const getSessionRole = cache(
    async (cookie: string): Promise<string | null> => {
        if (!cookie) return null;

        try {
            const session = await authClient.getSession({
                fetchOptions: { headers: serverAuthHeaders(cookie) },
            });
            const user = session.data?.user as { role?: string } | undefined;
            return user?.role ?? null;
        } catch {
            return null;
        }
    },
);

/** Exactly what the dashboard layout needs to render its shell and guard. */
export interface DashboardSession {
    name?: string;
    email?: string;
    image?: string | null;
    role?: string;
    /** Effective permission set; undefined on a transient fetch failure. */
    permissions?: string[];
    /** Whether a TOUR_OPERATOR has completed onboarding. */
    hasOperator: boolean;
}

/**
 * The layout's session load, in ONE parallel wave.
 *
 * This exists because `getUserProfile` does strictly more work than the layout
 * can use. Beyond this wave it also fetches the operator's company-info and
 * social-media records and, for admins, platform social settings - up to three
 * more round trips whose results the layout never reads. It passes only
 * name/email/image/role/permissions to `DashboardShell` and touches `operator`
 * solely to test EXISTENCE for the onboarding redirect, and `/users/me`
 * already carries that. Those extra calls were pure cold-start latency on
 * every full page load and hard refresh.
 *
 * `getUserProfile` keeps the extras for `onboardingActions`, which genuinely
 * reads the operator record. Do not "unify" the two by giving this one the
 * extras back - the difference is the point.
 *
 * Deliberately NOT cached across requests, for the same reason as
 * `getSessionRole`: caching a transient null logs a valid user out.
 */
export const getDashboardSession = cache(
    async (cookie: string): Promise<DashboardSession | null> => {
        if (!cookie) return null;

        try {
            const headers = serverAuthHeaders(cookie);
            const [sessionRes, userRes, permissionsRes] = await Promise.all([
                authClient.getSession({ fetchOptions: { headers } }),
                fetch(`${BACKEND_URL}/api/v1/users/me`, { headers }),
                fetch(`${BACKEND_URL}/api/v1/users/me/permissions`, {
                    headers,
                }),
            ]);

            if (!sessionRes.data?.user || !userRes.ok) return null;

            const userData = await safeJson(userRes);
            if (!userData) return null;

            // Effective set (staff/team fine-grained grants). On a transient
            // failure leave it undefined so `RoleProvider` falls back to the
            // static role map - the backend guards enforce regardless.
            const permissionsData = permissionsRes.ok
                ? await safeJson(permissionsRes)
                : null;

            return {
                name: userData.name,
                email: userData.email,
                image: userData.image,
                role: (sessionRes.data.user as { role?: string }).role,
                permissions: Array.isArray(permissionsData?.permissions)
                    ? permissionsData.permissions
                    : undefined,
                hasOperator: Boolean(userData.operator),
            };
        } catch {
            return null;
        }
    },
);
